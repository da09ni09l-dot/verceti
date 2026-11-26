-- Extend scoped content management to leaders and moderators without granting founder-only administration.
-- Private chat groups are visible only to their creator, members, and the founder.
-- Hidden voice rooms are visible to the founder, their creator, and explicitly assigned users.

alter table public.chat_groups
  add column if not exists is_private boolean not null default false;

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists chat_group_members_user_idx on public.chat_group_members(user_id, group_id);
alter table public.chat_group_members enable row level security;

drop policy if exists "Members can read chat groups" on public.chat_groups;
create policy "Members can read public or permitted chat groups"
on public.chat_groups for select to authenticated
using (
  public.is_verceti_member()
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

drop policy if exists "Leaders moderators admins create chat groups" on public.chat_groups;
create policy "Founder leaders moderators create chat groups"
on public.chat_groups for insert to authenticated
with check (
  public.is_verceti_member()
  and created_by = (select auth.uid())
  and public.current_verceti_role() in (
    'founder'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  )
);

drop policy if exists "Leaders moderators admins delete chat groups" on public.chat_groups;
drop policy if exists "Creators and founder manage chat groups" on public.chat_groups;
create policy "Creators and founder update chat groups"
on public.chat_groups for update to authenticated
using (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
)
with check (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
);
create policy "Creators and founder delete chat groups"
on public.chat_groups for delete to authenticated
using (
  created_by = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
);

create policy "Group members and managers read memberships"
on public.chat_group_members for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id
      and (g.created_by = (select auth.uid())
        or public.current_verceti_role() = 'founder'::public.verceti_role)
  )
);

create policy "Group managers add memberships"
on public.chat_group_members for insert to authenticated
with check (
  exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id
      and (g.created_by = (select auth.uid())
        or public.current_verceti_role() = 'founder'::public.verceti_role)
  )
  and added_by = (select auth.uid())
  and public.is_verceti_member()
);

create policy "Group managers remove memberships"
on public.chat_group_members for delete to authenticated
using (
  exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id
      and (g.created_by = (select auth.uid())
        or public.current_verceti_role() = 'founder'::public.verceti_role)
  )
);

grant select, insert, update, delete on public.chat_groups to authenticated;
grant select, insert, delete on public.chat_group_members to authenticated;

drop policy if exists "Members read chat messages" on public.chat_messages;
create policy "Members read permitted chat messages"
on public.chat_messages for select to authenticated
using (
  public.is_verceti_member()
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

drop policy if exists "Members send own chat messages" on public.chat_messages;
create policy "Members send messages to permitted chat groups"
on public.chat_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_verceti_member()
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

-- Keep the approved-account restrictive guard while limiting hidden-room visibility.
drop policy if exists "Members can view visible or assigned voice rooms" on public.voice_rooms;
create policy "Members can view visible or permitted hidden voice rooms"
on public.voice_rooms for select to authenticated
using (
  is_hidden = false
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or created_by = (select auth.uid())
  or exists (
    select 1 from public.voice_room_assignments a
    where a.room_id = voice_rooms.id and a.user_id = (select auth.uid())
  )
);

drop policy if exists "Staff can update voice rooms" on public.voice_rooms;
create policy "Creators and founder update voice rooms"
on public.voice_rooms for update to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
);

drop policy if exists "Staff can delete voice rooms" on public.voice_rooms;
create policy "Creators and founder delete voice rooms"
on public.voice_rooms for delete to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
);

drop policy if exists "Staff can manage voice room assignments" on public.voice_room_assignments;
create policy "Room creators and founder manage assignments"
on public.voice_room_assignments for all to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (
    public.is_verceti_staff()
    and exists (
      select 1 from public.voice_rooms r
      where r.id = voice_room_assignments.room_id
        and r.created_by = (select auth.uid())
    )
  )
)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (
    public.is_verceti_staff()
    and exists (
      select 1 from public.voice_rooms r
      where r.id = voice_room_assignments.room_id
        and r.created_by = (select auth.uid())
    )
  )
);

-- Moderators receive the same scoped roulette prize management as leaders.
drop policy if exists "Founder and leaders can add shared rewards prizes" on public.rewards_prizes;
create policy "Founder leaders moderators add rewards prizes"
on public.rewards_prizes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.current_verceti_role() in (
    'founder'::public.verceti_role,
    'leader'::public.verceti_role,
    'moderator'::public.verceti_role
  )
);

drop policy if exists "Founder and leaders can update shared rewards prizes" on public.rewards_prizes;
create policy "Founder leaders moderators update own rewards prizes"
on public.rewards_prizes for update to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (
    public.current_verceti_role() in ('leader'::public.verceti_role, 'moderator'::public.verceti_role)
    and created_by = (select auth.uid())
  )
)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (
    public.current_verceti_role() in ('leader'::public.verceti_role, 'moderator'::public.verceti_role)
    and created_by = (select auth.uid())
  )
);

drop policy if exists "Founder and leaders can delete shared rewards prizes" on public.rewards_prizes;
create policy "Founder leaders moderators delete own rewards prizes"
on public.rewards_prizes for delete to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (
    public.current_verceti_role() in ('leader'::public.verceti_role, 'moderator'::public.verceti_role)
    and created_by = (select auth.uid())
  )
);
