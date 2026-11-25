-- Hidden voice rooms and staff-controlled member assignments.
alter table public.voice_rooms
  add column if not exists is_hidden boolean not null default false;

create table if not exists public.voice_room_assignments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  room_id bigint not null references public.voice_rooms(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.voice_room_assignments enable row level security;

drop policy if exists "Everyone can view voice rooms" on public.voice_rooms;
drop policy if exists "Authenticated users can view voice rooms" on public.voice_rooms;

-- Preserve active-account and approved-member guards for every voice-room operation.
drop policy if exists "voice_rooms_active_member_guard" on public.voice_rooms;
create policy "voice_rooms_active_member_guard"
on public.voice_rooms as restrictive
for all to authenticated
using (public.is_verceti_account_active() and public.is_verceti_member())
with check (public.is_verceti_account_active() and public.is_verceti_member());

create policy "Members can view visible or assigned voice rooms"
on public.voice_rooms
for select to authenticated
using (
  is_hidden = false
  or public.is_verceti_staff()
  or exists (
    select 1 from public.voice_room_assignments a
    where a.room_id = voice_rooms.id and a.user_id = (select auth.uid())
  )
);

drop policy if exists "Staff can update voice rooms" on public.voice_rooms;
create policy "Staff can update voice rooms"
on public.voice_rooms
for update to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

drop policy if exists "Staff can manage voice room assignments" on public.voice_room_assignments;
create policy "Staff can manage voice room assignments"
on public.voice_room_assignments
for all to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

drop policy if exists "Members can read their own voice room assignment" on public.voice_room_assignments;
create policy "Members can read their own voice room assignment"
on public.voice_room_assignments
for select to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.voice_room_assignments to authenticated;
grant select, update on public.voice_rooms to authenticated;
