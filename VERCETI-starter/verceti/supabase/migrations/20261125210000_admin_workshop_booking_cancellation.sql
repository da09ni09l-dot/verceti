grant delete on public.workshop_bookings to authenticated;

drop policy if exists "Users can delete own workshop bookings" on public.workshop_bookings;
create policy "Members, founder and leader can cancel workshop bookings"
on public.workshop_bookings
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() in ('founder'::public.verceti_role, 'admin'::public.verceti_role, 'leader'::public.verceti_role)
);
