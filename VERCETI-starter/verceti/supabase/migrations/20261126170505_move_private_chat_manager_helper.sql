-- Keep the SECURITY DEFINER helper outside PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_chat_group_manager(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.chat_groups g
    where g.id = p_group_id
      and (g.created_by = auth.uid()
        or public.current_verceti_role() = 'founder'::public.verceti_role)
  );
$$;
revoke all on function private.is_chat_group_manager(uuid) from public, anon;
grant execute on function private.is_chat_group_manager(uuid) to authenticated;

drop policy if exists "Group members and managers read memberships" on public.chat_group_members;
create policy "Group members and managers read memberships"
on public.chat_group_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_chat_group_manager(group_id)
);

drop function if exists public.is_chat_group_manager(uuid);
