-- Staff can read the member directory used by chat and voice-room management.
drop policy if exists "approved_member_guard" on public.profiles;
create policy "approved_member_or_staff_guard"
on public.profiles as restrictive
for all to authenticated
using (
  public.is_verceti_member()
  or public.is_verceti_staff()
  or id = (select auth.uid())
)
with check (
  public.is_verceti_member()
  or public.is_verceti_staff()
  or id = (select auth.uid())
);
