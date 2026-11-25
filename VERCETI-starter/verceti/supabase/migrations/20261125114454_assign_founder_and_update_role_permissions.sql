-- Assign the founder role and establish the initial staff permissions.
update public.profiles
set role = 'founder'::public.verceti_role
where nickname = 'Gexon' and role = 'admin'::public.verceti_role;

create or replace function public.is_verceti_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_verceti_role() in (
    'founder'::public.verceti_role,
    'admin'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  ), false);
$$;

create or replace function public.change_member_role(
  p_member_id uuid,
  p_new_role public.verceti_role,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.verceti_role;
  v_old_role public.verceti_role;
begin
  v_actor_role := public.current_verceti_role();
  if auth.uid() is null or v_actor_role not in (
    'founder'::public.verceti_role,
    'admin'::public.verceti_role,
    'leader'::public.verceti_role
  ) then
    raise exception 'Only founder, admin or leader can change roles';
  end if;
  if p_member_id = auth.uid() then raise exception 'self_role_change_forbidden'; end if;
  select role into v_old_role from public.profiles where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;
  if v_actor_role = 'leader'::public.verceti_role
     and (v_old_role in ('founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role)
       or p_new_role in ('founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role)) then
    raise exception 'Leader cannot change protected role assignments';
  end if;
  if v_old_role = p_new_role then return; end if;
  update public.profiles set role = p_new_role where id = p_member_id;
  insert into public.role_history(member_id, changed_by, old_role, new_role, reason)
  values (p_member_id, auth.uid(), v_old_role, p_new_role, p_reason);
end;
$$;

create or replace function public.review_application(
  p_application_id uuid,
  p_status public.application_status,
  p_note text default null,
  p_assigned_role public.verceti_role default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_role public.verceti_role;
  v_user_id uuid;
  v_old_role public.verceti_role;
begin
  v_reviewer_role := public.current_verceti_role();
  if auth.uid() is null or v_reviewer_role not in (
    'founder'::public.verceti_role,
    'admin'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  ) then
    raise exception 'Insufficient permissions';
  end if;
  if p_status not in ('approved', 'rejected', 'needs_changes') then
    raise exception 'Invalid review status';
  end if;
  select a.user_id into v_user_id
  from public.applications a
  where a.id = p_application_id and a.status = 'pending'
  for update;
  if not found then raise exception 'Pending application not found'; end if;
  if v_user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if p_assigned_role is not null and p_status <> 'approved' then
    raise exception 'A role can only be assigned when approved';
  end if;
  if p_assigned_role is not null then
    if v_reviewer_role = 'moderator'::public.verceti_role then
      raise exception 'Moderator cannot assign roles';
    end if;
    if v_reviewer_role = 'leader'::public.verceti_role
       and p_assigned_role in ('founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role) then
      raise exception 'Leader cannot assign protected roles';
    end if;
  end if;
  update public.applications
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
      assigned_role = p_assigned_role, reviewer_note = p_note
  where id = p_application_id;
  if p_assigned_role is not null then
    select p.role into v_old_role from public.profiles p where p.id = v_user_id for update;
    if v_old_role is distinct from p_assigned_role then
      update public.profiles set role = p_assigned_role where id = v_user_id;
      insert into public.role_history(member_id, changed_by, old_role, new_role, reason)
      values (v_user_id, auth.uid(), v_old_role, p_assigned_role, p_note);
    end if;
  end if;
end;
$$;
