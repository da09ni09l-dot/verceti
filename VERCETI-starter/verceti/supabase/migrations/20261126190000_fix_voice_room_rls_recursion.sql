-- Break the circular RLS dependency between voice_rooms and voice_room_assignments.
-- The voice_rooms SELECT policy must not query voice_room_assignments under its
-- own RLS policies, because assignment policies also inspect voice_rooms.

create or replace function private.is_voice_room_assigned(
  p_room_id bigint,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.voice_room_assignments a
    where a.room_id = p_room_id
      and a.user_id = p_user_id
  );
$$;

revoke all on function private.is_voice_room_assigned(bigint, uuid) from public, anon;
grant execute on function private.is_voice_room_assigned(bigint, uuid) to authenticated;

drop policy if exists "Members and staff read permitted voice rooms" on public.voice_rooms;
drop policy if exists "Members can view visible or permitted hidden voice rooms" on public.voice_rooms;
drop policy if exists "Members can view visible or assigned voice rooms" on public.voice_rooms;

create policy "Members can view visible or permitted hidden voice rooms"
on public.voice_rooms
for select
to authenticated
using (
  is_hidden = false
  or public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.is_verceti_staff() and created_by = (select auth.uid()))
  or private.is_voice_room_assigned(id, (select auth.uid()))
);
