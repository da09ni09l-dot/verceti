create table if not exists public.password_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text
);

create index if not exists password_change_requests_user_status_idx
  on public.password_change_requests (user_id, status, requested_at desc);

alter table public.password_change_requests enable row level security;

create policy "Users can submit own password change requests"
  on public.password_change_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Users can read own password change requests"
  on public.password_change_requests for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Staff can read password change requests"
  on public.password_change_requests for select to authenticated
  using (public.is_verceti_staff());

create policy "Admins can review password change requests"
  on public.password_change_requests for update to authenticated
  using (public.current_verceti_role() = 'admin')
  with check (public.current_verceti_role() = 'admin');
