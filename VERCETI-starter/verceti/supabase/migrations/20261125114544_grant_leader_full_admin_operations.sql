-- Initial compatibility grants; founder-only migration later tightens these.
create or replace function public.delete_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_verceti_role() not in (
    'founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role
  ) then raise exception 'admin_or_leader_only'; end if;
  delete from public.applications where id = p_application_id;
  if not found then raise exception 'application_not_found'; end if;
end;
$$;

create or replace function public.admin_update_member_birthday(
  p_user_id uuid, p_birth_day smallint, p_birth_month smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_verceti_role() not in (
    'founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role
  ) then raise exception 'admin_or_leader_only'; end if;
  if p_birth_month < 1 or p_birth_month > 12 or p_birth_day < 1
     or p_birth_day > extract(day from (make_date(2000, p_birth_month, 1) + interval '1 month - 1 day'))::int then
    raise exception 'invalid_birthday';
  end if;
  update public.profiles set birth_day = p_birth_day, birth_month = p_birth_month where id = p_user_id;
  if not found then raise exception 'profile_not_found'; end if;
end;
$$;
