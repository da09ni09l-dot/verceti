grant delete on public.workshop_bookings to authenticated;

drop policy if exists "Users can delete own workshop bookings" on public.workshop_bookings;
create policy "Members and founder can cancel workshop bookings"
on public.workshop_bookings
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() = 'founder'::public.verceti_role
);
