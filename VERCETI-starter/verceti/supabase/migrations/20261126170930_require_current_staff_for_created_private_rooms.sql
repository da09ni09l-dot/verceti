-- A former room/group creator retains access only while currently authorized as staff.
-- Explicitly invited members keep access to private chats and hidden voice rooms.

drop policy if exists "Members and staff read public or permitted chat groups" on public.chat_groups;
create policy "Members and staff read public or permitted chat groups"
on public.chat_groups for select to authenticated
using (
  (public.is_verceti_member() or public.is_verceti_staff())
  and (
    is_private = false
    or (public.is_verceti_staff() and created_by = (select auth.uid()))
    or public.current_verceti_role() = 'founder'::public.verceti_role
    or exists (
      select 1 from public.chat_group_members m
      where m.group_id = chat_groups.id and m.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Creators founder and admin update public groups" on public.chat_groups;
create policy "Creators founder and admin update public groups"
on public.chat_groups for update to authenticated
using (
  (public.is_verceti_staff() and created_by = (select auth.uid()))
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_private = false)
)
with check (
  (public.is_verceti_staff() and created_by = (select auth.uid()))
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'admin'::public.verceti_role and is_private = false)
);

drop policy if exists "Creators founder and admin delete public groups" on public.chat_groups;
create policy "Creators founder and admin delete public groups"
on public.chat_groups for delete to authenticated
using (
  (public.is_verceti_staff() and created_by = (select auth.uid()))
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
        (public.is_verceti_staff() and g.created_by = auth.uid())
        or public.current_verceti_role() = 'founder'::public.verceti_role
        or (public.current_verceti_role() = 'admin'::public.verceti_role and g.is_private = false)
      )
  );
$$;
revoke all on function private.is_chat_group_manager(uuid) from public, anon;
grant execute on function private.is_chat_group_manager(uuid) to authenticated;

drop policy if exists "Members and staff read permitted chat messages" on public.chat_messages;
create policy "Members and staff read permitted chat messages"
on public.chat_messages for select to authenticated
using (
  (public.is_verceti_member() or public.is_verceti_staff())
  and (
    group_id is null
    or exists (
      select 1 from public.chat_groups g
      where g.id = chat_messages.group_id
        and (
          g.is_private = false
          or (public.is_verceti_staff() and g.created_by = (select auth.uid()))
          or public.current_verceti_role() = 'founder'::public.verceti_role
          or exists (
            select 1 from public.chat_group_members m
            where m.group_id = g.id and m.user_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "Members and staff send messages to permitted chat groups" on public.chat_messages;
create policy "Members and staff send messages to permitted chat groups"
on public.chat_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (public.is_verceti_member() or public.is_verceti_staff())
  and length(trim(content)) between 1 and 2000
  and (
    group_id is null
    or exists (
      select 1 from public.chat_groups g
      where g.id = chat_messages.group_id
        and (
          g.is_private = false
          or (public.is_verceti_staff() and g.created_by = (select auth.uid()))
          or public.current_verceti_role() = 'founder'::public.verceti_role
          or exists (
            select 1 from public.chat_group_members m
            where m.group_id = g.id and m.user_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "Members can view visible or permitted hidden voice rooms" on public.voice_rooms;
create policy "Members can view visible or permitted hidden voice rooms"
on public.voice_rooms for select to authenticated
using (
  is_hidden = false
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
  or exists (
    select 1 from public.voice_room_assignments a
    where a.room_id = voice_rooms.id and a.user_id = (select auth.uid())
  )
);
