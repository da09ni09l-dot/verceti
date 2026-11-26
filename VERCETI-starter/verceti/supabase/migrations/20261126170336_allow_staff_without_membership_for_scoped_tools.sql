-- Staff with active accounts may use their scoped management tools even if
-- their community-membership flag is not set. This does not grant admin powers.

drop policy if exists "Members can read public or permitted chat groups" on public.chat_groups;
create policy "Members and staff read public or permitted chat groups"
on public.chat_groups for select to authenticated
using (
  (public.is_verceti_member() or public.is_verceti_staff())
  and (
    is_private = false
    or created_by = (select auth.uid())
    or public.current_verceti_role() = 'founder'::public.verceti_role
    or exists (
      select 1 from public.chat_group_members m
      where m.group_id = chat_groups.id and m.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Founder leaders moderators create chat groups" on public.chat_groups;
create policy "Founder leaders moderators create chat groups"
on public.chat_groups for insert to authenticated
with check (
  (public.is_verceti_member() or public.is_verceti_staff())
  and created_by = (select auth.uid())
  and public.current_verceti_role() in (
    'founder'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  )
);

drop policy if exists "Members read permitted chat messages" on public.chat_messages;
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
          or g.created_by = (select auth.uid())
          or public.current_verceti_role() = 'founder'::public.verceti_role
          or exists (
            select 1 from public.chat_group_members m
            where m.group_id = g.id and m.user_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "Members send messages to permitted chat groups" on public.chat_messages;
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
          or g.created_by = (select auth.uid())
          or public.current_verceti_role() = 'founder'::public.verceti_role
          or exists (
            select 1 from public.chat_group_members m
            where m.group_id = g.id and m.user_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "approved_member_guard" on public.chat_messages;
create policy "approved_member_or_staff_guard"
on public.chat_messages as restrictive
for all to authenticated
using (public.is_verceti_member() or public.is_verceti_staff())
with check (public.is_verceti_member() or public.is_verceti_staff());

drop policy if exists "approved_member_guard" on public.news;
create policy "approved_member_or_staff_guard"
on public.news as restrictive
for all to authenticated
using (public.is_verceti_member() or public.is_verceti_staff())
with check (public.is_verceti_member() or public.is_verceti_staff());

drop policy if exists "approved_member_guard" on public.rewards_prizes;
create policy "approved_member_or_staff_guard"
on public.rewards_prizes as restrictive
for all to authenticated
using (public.is_verceti_member() or public.is_verceti_staff())
with check (public.is_verceti_member() or public.is_verceti_staff());

drop policy if exists "Authenticated users can view active rewards prizes" on public.rewards_prizes;
create policy "Authenticated users can view active or own rewards prizes"
on public.rewards_prizes for select to authenticated
using (
  is_active
  or public.current_verceti_role() in ('founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role)
  or (
    public.current_verceti_role() = 'moderator'::public.verceti_role
    and created_by = (select auth.uid())
  )
);
