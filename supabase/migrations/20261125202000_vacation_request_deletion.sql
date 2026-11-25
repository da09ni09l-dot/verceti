grant delete on public.vacation_requests to authenticated;
drop policy if exists "Leaders and admins can delete vacation requests" on public.vacation_requests;
create policy "Leaders and admins can delete vacation requests"
on public.vacation_requests for delete to authenticated
using (public.current_verceti_role() in ('admin','leader'));
