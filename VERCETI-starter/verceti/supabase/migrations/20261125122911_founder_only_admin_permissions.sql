-- Enforce the VERCETI role model: only the founder has administrative-panel powers.
-- Leaders retain application review and voice-room moderation only.

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
  if auth.uid() is null or v_actor_role <> 'founder'::public.verceti_role then
    raise exception 'founder_only';
  end if;
  if p_member_id = auth.uid() then
    raise exception 'self_role_change_forbidden';
  end if;
  if p_new_role in ('founder'::public.verceti_role, 'admin'::public.verceti_role) then
    raise exception 'protected_role_assignment';
  end if;

  select role into v_old_role
  from public.profiles
  where id = p_member_id
  for update;

  if not found then raise exception 'Member not found'; end if;
  if v_old_role = 'founder'::public.verceti_role then
    raise exception 'founder_role_protected';
  end if;
  if v_old_role = p_new_role then return; end if;

  update public.profiles set role = p_new_role where id = p_member_id;
  insert into public.role_history(member_id, changed_by, old_role, new_role, reason)
  values (p_member_id, auth.uid(), v_old_role, p_new_role, p_reason);
end;
$$;

create or replace function public.delete_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_verceti_role() <> 'founder'::public.verceti_role then
    raise exception 'founder_only';
  end if;
  delete from public.applications where id = p_application_id;
  if not found then raise exception 'application_not_found'; end if;
end;
$$;

create or replace function public.admin_update_member_birthday(
  p_user_id uuid,
  p_birth_day smallint,
  p_birth_month smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_verceti_role() <> 'founder'::public.verceti_role then
    raise exception 'founder_only';
  end if;
  if p_birth_month < 1 or p_birth_month > 12 or p_birth_day < 1
     or p_birth_day > extract(day from (make_date(2000, p_birth_month, 1) + interval '1 month - 1 day'))::int then
    raise exception 'invalid_birthday';
  end if;
  update public.profiles
  set birth_day = p_birth_day, birth_month = p_birth_month
  where id = p_user_id;
  if not found then raise exception 'profile_not_found'; end if;
end;
$$;

-- Vacation approvals and administration belong to the founder only.
drop policy if exists "Leaders and admins can delete vacation requests" on public.vacation_requests;
create policy "Founder can delete approved vacation requests"
on public.vacation_requests
for delete
to authenticated
using (public.current_verceti_role() = 'founder'::public.verceti_role);

drop policy if exists "Staff can review vacation requests" on public.vacation_requests;
create policy "Founder can review vacation requests"
on public.vacation_requests
for update
to authenticated
using (public.current_verceti_role() = 'founder'::public.verceti_role)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  and status in ('approved', 'rejected')
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
);

drop policy if exists "Members and staff can read vacation requests" on public.vacation_requests;
create policy "Members and founder can read vacation requests"
on public.vacation_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
);

-- Members may cancel their own bookings; administrative cancellation is founder-only.
drop policy if exists "Members and admins can cancel workshop bookings" on public.workshop_bookings;
drop policy if exists "Members, founder and leader can cancel workshop bookings" on public.workshop_bookings;
drop policy if exists "Members and founder can cancel workshop bookings" on public.workshop_bookings;
create policy "Members and founder can cancel workshop bookings"
on public.workshop_bookings
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
);

-- Staff must pass the restrictive voice-room membership guard, even if their
-- profile does not carry a separate member flag.
drop policy if exists "approved_member_guard" on public.voice_rooms;
create policy "approved_member_guard"
on public.voice_rooms as restrictive
for all
to authenticated
using (public.is_verceti_member() or public.is_verceti_staff())
with check (public.is_verceti_member() or public.is_verceti_staff());

drop policy if exists "voice_rooms_active_member_guard" on public.voice_rooms;
create policy "voice_rooms_active_member_guard"
on public.voice_rooms as restrictive
for all
to authenticated
using (
  public.is_verceti_account_active()
  and (public.is_verceti_member() or public.is_verceti_staff())
)
with check (
  public.is_verceti_account_active()
  and (public.is_verceti_member() or public.is_verceti_staff())
);
