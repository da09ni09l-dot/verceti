create extension if not exists pgcrypto;

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
alter table public.support_requests add column if not exists access_token uuid not null default gen_random_uuid();
alter table public.support_requests enable row level security;

drop policy if exists "Anyone can submit support requests" on public.support_requests;
create policy "Anyone can submit support requests" on public.support_requests for insert to anon, authenticated with check (true);
drop policy if exists "Admins can read support requests" on public.support_requests;
create policy "Admins can read support requests" on public.support_requests for select to authenticated using (public.current_verceti_role() = 'admin');
grant insert on public.support_requests to anon, authenticated;
grant select on public.support_requests to authenticated;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor', 'admin')),
  sender_id uuid references auth.users(id) on delete set null,
  message text not null check (char_length(message) between 2 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_request_created_idx on public.support_messages(request_id, created_at);
alter table public.support_messages enable row level security;
drop policy if exists "Admins can read support messages" on public.support_messages;
create policy "Admins can read support messages" on public.support_messages for select to authenticated using (public.current_verceti_role() = 'admin');
grant select on public.support_messages to authenticated;

insert into public.support_messages (request_id, sender_type, message, created_at)
select r.id, 'visitor', r.message, r.created_at from public.support_requests r
where not exists (select 1 from public.support_messages m where m.request_id = r.id);
