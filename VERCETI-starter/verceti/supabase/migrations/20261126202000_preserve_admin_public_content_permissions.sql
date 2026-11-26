-- Preserve pre-existing Admin access to public chat/voice spaces.
-- Admins do not gain visibility into hidden voice rooms or private chats.

drop policy if exists "Founder leaders moderators create chat groups" on public.chat_groups;
create policy "Founder admin leaders moderators create chat groups"
on public.chat_groups for insert to authenticated
with check (
  (public.is_verceti_member() or public.is_verceti_staff())
  and created_by = (select auth.uid())
  and public.current_verceti_role() in (
    'founder'::public.verceti_role,
    'admin'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  )
);

drop policy if exists "Creators and founder update chat groups" on public.chat_groups;
create policy "Creators founder and admin update public groups"
on public.chat_groups for update to authenticated
using (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_private = false)
)
with check (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_private = false)
);

drop policy if exists "Creators and founder delete chat groups" on public.chat_groups;
create policy "Creators founder and admin delete public groups"
on public.chat_groups for delete to authenticated
using (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_private = false)
);

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
      and (
        g.created_by = auth.uid()
        or public.current_verceti_role() = 'founder'::public.verceti_role
        or (public.current_verceti_role() = 'admin'::public.verceti_role and g.is_private = false)
      )
  );
$$;
revoke all on function private.is_chat_group_manager(uuid) from public, anon;
grant execute on function private.is_chat_group_manager(uuid) to authenticated;

drop policy if exists "Group managers add memberships" on public.chat_group_members;
create policy "Group managers add memberships"
on public.chat_group_members for insert to authenticated
with check (
  private.is_chat_group_manager(group_id)
  and added_by = (select auth.uid())
  and (public.is_verceti_member() or public.is_verceti_staff())
);

drop policy if exists "Group managers remove memberships" on public.chat_group_members;
create policy "Group managers remove memberships"
on public.chat_group_members for delete to authenticated
using (private.is_chat_group_manager(group_id));

drop policy if exists "Creators and founder update voice rooms" on public.voice_rooms;
create policy "Creators founder and admin update public voice rooms"
on public.voice_rooms for update to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_hidden = false)
)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_hidden = false)
);

drop policy if exists "Creators and founder delete voice rooms" on public.voice_rooms;
create policy "Creators founder and admin delete public voice rooms"
on public.voice_rooms for delete to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_hidden = false)
);
