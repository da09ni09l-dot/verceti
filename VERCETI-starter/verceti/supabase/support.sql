create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  sender_name text not null check (char_length(sender_name) between 2 and 80),
  sender_email text not null check (char_length(sender_email) between 5 and 160),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

drop policy if exists "Anyone can submit support requests" on public.support_requests;
create policy "Anyone can submit support requests"
on public.support_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can read support requests" on public.support_requests;
create policy "Admins can read support requests"
on public.support_requests for select
to authenticated
using (public.current_verceti_role() = 'admin');

grant insert on public.support_requests to anon, authenticated;
grant select on public.support_requests to authenticated;
