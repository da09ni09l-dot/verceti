alter table public.support_requests alter column sender_email drop not null;
alter table public.support_requests drop constraint if exists support_requests_sender_email_check;
drop index if exists public.support_requests_email_created_idx;
create index if not exists support_requests_nickname_created_idx on public.support_requests (lower(sender_name), created_at desc);
