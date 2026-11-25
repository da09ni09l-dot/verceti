grant delete on public.workshop_bookings to authenticated;

drop policy if exists "Admins can delete any workshop booking" on public.workshop_bookings;
create policy "Admins can delete any workshop booking"
on public.workshop_bookings
for delete
to authenticated
using (public.current_verceti_role() = 'admin');
