create table if not exists public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  constraint vacation_requests_valid_dates check (end_date >= start_date),
  constraint vacation_requests_reason_length check (
    char_length(btrim(reason)) between 3 and 2000
  ),
  constraint vacation_requests_review_consistency check (
    (status = 'pending' and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);

create index if not exists vacation_requests_user_dates_idx
  on public.vacation_requests (user_id, start_date, end_date);

create index if not exists vacation_requests_status_created_idx
  on public.vacation_requests (status, created_at desc);

alter table public.vacation_requests enable row level security;

revoke all on public.vacation_requests from anon, authenticated;
grant select, insert, update on public.vacation_requests to authenticated;

create policy "Members and staff can read vacation requests"
  on public.vacation_requests
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_verceti_staff())
  );

create policy "Members can submit own vacation requests"
  on public.vacation_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Staff can review vacation requests"
  on public.vacation_requests
  for update
  to authenticated
  using ((select public.is_verceti_staff()))
  with check (
    (select public.is_verceti_staff())
    and status in ('approved', 'rejected')
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
  );
