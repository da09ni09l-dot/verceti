-- Restore the established leader workflow without granting site-admin privileges.
-- Leaders may manage workshop bookings, vacation requests, and shared roulette entries.
-- The founder remains the only role with full application administration.

drop policy if exists "Members and founder can cancel workshop bookings" on public.workshop_bookings;
drop policy if exists "Members, founder and leader can cancel workshop bookings" on public.workshop_bookings;
create policy "Members, founder and leader can cancel workshop bookings"
on public.workshop_bookings
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
);

drop policy if exists "Founder can delete approved vacation requests" on public.vacation_requests;
create policy "Founder and leader can delete approved vacation requests"
on public.vacation_requests
for delete
to authenticated
using (
  public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
);

drop policy if exists "Founder can review vacation requests" on public.vacation_requests;
create policy "Founder and leader can review vacation requests"
on public.vacation_requests
for update
to authenticated
using (
  public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
)
with check (
  public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
  and status in ('approved', 'rejected')
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
);

drop policy if exists "Members and founder can read vacation requests" on public.vacation_requests;
create policy "Members, founder and leader can read vacation requests"
on public.vacation_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
);

-- Roulette: leaders may create and manage shared prizes; founder retains full control.
drop policy if exists "Leaders can add shared rewards prizes" on public.rewards_prizes;
create policy "Founder and leaders can add shared rewards prizes"
on public.rewards_prizes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.current_verceti_role() in ('founder'::public.verceti_role, 'leader'::public.verceti_role)
);

drop policy if exists "Leaders can update shared rewards prizes" on public.rewards_prizes;
create policy "Founder and leaders can update shared rewards prizes"
on public.rewards_prizes
for update
to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'leader'::public.verceti_role and created_by = (select auth.uid()))
)
with check (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'leader'::public.verceti_role and created_by = (select auth.uid()))
);

drop policy if exists "Leaders can delete shared rewards prizes" on public.rewards_prizes;
create policy "Founder and leaders can delete shared rewards prizes"
on public.rewards_prizes
for delete
to authenticated
using (
  public.current_verceti_role() = 'founder'::public.verceti_role
  or (public.current_verceti_role() = 'leader'::public.verceti_role and created_by = (select auth.uid()))
);
