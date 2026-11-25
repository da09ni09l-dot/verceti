create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 240),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.chat_groups enable row level security;
drop policy if exists "Members can read chat groups" on public.chat_groups;
create policy "Members can read chat groups" on public.chat_groups for select to authenticated using (public.is_verceti_member());
drop policy if exists "Leaders moderators admins create chat groups" on public.chat_groups;
create policy "Leaders moderators admins create chat groups" on public.chat_groups for insert to authenticated
with check (public.is_verceti_member() and created_by = (select auth.uid()) and public.current_verceti_role() in ('admin','leader','moderator'));
drop policy if exists "Leaders moderators admins delete chat groups" on public.chat_groups;
create policy "Leaders moderators admins delete chat groups" on public.chat_groups for delete to authenticated
using (public.current_verceti_role() in ('admin','leader','moderator'));
grant select, insert, delete on public.chat_groups to authenticated;

alter table public.chat_messages add column if not exists group_id uuid references public.chat_groups(id) on delete cascade;
create index if not exists chat_messages_group_created_idx on public.chat_messages(group_id, created_at);
drop policy if exists "Members can read chat messages" on public.chat_messages;
drop policy if exists "Members read chat messages" on public.chat_messages;
create policy "Members read chat messages" on public.chat_messages for select to authenticated
using (public.is_verceti_member() and (group_id is null or exists (select 1 from public.chat_groups g where g.id = group_id)));
drop policy if exists "Members can send their own messages" on public.chat_messages;
drop policy if exists "Members send own chat messages" on public.chat_messages;
create policy "Members send own chat messages" on public.chat_messages for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_verceti_member() and (length(trim(content)) between 1 and 2000)
and (group_id is null or exists (select 1 from public.chat_groups g where g.id = group_id)));
