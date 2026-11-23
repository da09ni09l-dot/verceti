-- =========================================================
-- VERCETI | Missing application feature tables and policies
-- Run AFTER schema.sql and profile_access_patch.sql.
-- Safe to re-run on an existing installation.
-- =========================================================

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists is_banned boolean not null default false;
grant select (is_banned) on public.profiles to authenticated;
grant select (game_id) on public.profiles to authenticated;

-- Preserve moderation and role-history records when an actor account is deleted.
alter table public.disciplinary_actions
  alter column issued_by drop not null;
alter table public.role_history
  alter column changed_by drop not null;

-- NEWS
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  category text not null default 'announcement'
    check (category in ('announcement', 'event', 'update', 'important')),
  event_date timestamptz,
  is_pinned boolean not null default false,
  show_from timestamptz,
  show_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint news_display_period_check
    check (show_from is null or show_until is null or show_until > show_from)
);
alter table public.news add column if not exists event_date timestamptz;
alter table public.news add column if not exists is_pinned boolean not null default false;
alter table public.news add column if not exists show_from timestamptz;
alter table public.news add column if not exists show_until timestamptz;
alter table public.news enable row level security;

drop policy if exists "Authenticated can read news" on public.news;
create policy "Authenticated can read news" on public.news
for select to authenticated using (true);
drop policy if exists "Staff manage news" on public.news;
create policy "Staff manage news" on public.news
for all to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

-- PERSONAL NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  message text not null default '',
  type text not null default 'system',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "Members read own notifications" on public.notifications;
create policy "Members read own notifications" on public.notifications
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Members update own notifications" on public.notifications;
create policy "Members update own notifications" on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- PUBLIC CHAT AND DIRECT MESSAGES
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_idx
  on public.chat_messages(created_at desc);
alter table public.chat_messages enable row level security;

drop policy if exists "Members read chat messages" on public.chat_messages;
create policy "Members read chat messages" on public.chat_messages
for select to authenticated using (true);
drop policy if exists "Members send own chat messages" on public.chat_messages;
create policy "Members send own chat messages" on public.chat_messages
for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists "Members delete own chat messages" on public.chat_messages;
create policy "Members delete own chat messages" on public.chat_messages
for delete to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);
create index if not exists direct_messages_pair_created_idx
  on public.direct_messages(sender_id, recipient_id, created_at);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages(recipient_id, is_read, created_at desc);
alter table public.direct_messages enable row level security;

drop policy if exists "Participants read direct messages" on public.direct_messages;
create policy "Participants read direct messages" on public.direct_messages
for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "Members send direct messages as self" on public.direct_messages;
create policy "Members send direct messages as self" on public.direct_messages
for insert to authenticated
with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()));
drop policy if exists "Recipients mark direct messages read" on public.direct_messages;
create policy "Recipients mark direct messages read" on public.direct_messages
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
drop policy if exists "Senders delete own direct messages" on public.direct_messages;
create policy "Senders delete own direct messages" on public.direct_messages
for delete to authenticated
using (sender_id = (select auth.uid()));

-- APPLICATION FORM BUILDER
create table if not exists public.application_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(btrim(question)) between 1 and 1000),
  description text,
  question_type text not null default 'text'
    check (question_type in ('text', 'textarea', 'select')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.application_questions enable row level security;

drop policy if exists "Members read active application questions" on public.application_questions;
create policy "Members read active application questions" on public.application_questions
for select to authenticated
using (is_active or public.is_verceti_staff());
drop policy if exists "Staff manage application questions" on public.application_questions;
create policy "Staff manage application questions" on public.application_questions
for all to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

-- COMMUNITY RULES
create table if not exists public.community_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_rules enable row level security;

drop policy if exists "Members read community rules" on public.community_rules;
create policy "Members read community rules" on public.community_rules
for select to authenticated using (true);
drop policy if exists "Staff manage community rules" on public.community_rules;
create policy "Staff manage community rules" on public.community_rules
for all to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

-- TESTING MODULE (server actions use the service-role client after role checks)
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 5000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);
create index if not exists test_questions_test_position_idx
  on public.test_questions(test_id, position);
create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.test_questions(id) on delete cascade,
  answer text not null check (char_length(btrim(answer)) between 1 and 2000),
  is_correct boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);
create index if not exists test_answers_question_position_idx
  on public.test_answers(question_id, position);
create table if not exists public.test_permissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint test_permissions_unique_user unique(test_id, user_id)
);
create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  attempt_number integer not null check (attempt_number > 0),
  created_at timestamptz not null default now(),
  constraint test_results_attempt_unique unique(test_id, user_id, attempt_number)
);
create index if not exists test_results_user_created_idx
  on public.test_results(user_id, created_at desc);
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_answers enable row level security;
alter table public.test_permissions enable row level security;
alter table public.test_results enable row level security;

-- Music is read/written by authenticated members under row-level policies.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  artist text not null default '',
  source text not null check (source in ('Audius', 'Jamendo', 'YouTube', 'SoundCloud')),
  url text not null check (char_length(url) between 1 and 3000),
  playlist_type text not null check (playlist_type in ('personal', 'shared')),
  user_id uuid references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personal_track_owner_required
    check (playlist_type <> 'personal' or user_id is not null),
  constraint shared_track_has_no_owner
    check (playlist_type <> 'shared' or user_id is null)
);
create index if not exists music_tracks_playlist_created_idx
  on public.music_tracks(playlist_type, created_at desc);
create table if not exists public.music_favorites (
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(track_id, user_id)
);
create table if not exists public.music_recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  artist text not null default '',
  source text not null check (source in ('Audius', 'Jamendo', 'YouTube', 'SoundCloud')),
  url text not null check (char_length(url) between 1 and 3000),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.music_tracks enable row level security;
alter table public.music_favorites enable row level security;
alter table public.music_recommendations enable row level security;

drop policy if exists "Members read permitted music tracks" on public.music_tracks;
create policy "Members read permitted music tracks" on public.music_tracks
for select to authenticated
using (playlist_type = 'shared' or user_id = (select auth.uid()));
drop policy if exists "Members add own music and staff add shared music" on public.music_tracks;
create policy "Members add own music and staff add shared music" on public.music_tracks
for insert to authenticated
with check (
  (playlist_type = 'personal' and user_id = (select auth.uid()) and created_by = (select auth.uid()))
  or
  (playlist_type = 'shared' and user_id is null and created_by = (select auth.uid()) and public.is_verceti_staff())
);
drop policy if exists "Owners or staff delete music tracks" on public.music_tracks;
create policy "Owners or staff delete music tracks" on public.music_tracks
for delete to authenticated
using (
  (playlist_type = 'personal' and user_id = (select auth.uid()))
  or
  (playlist_type = 'shared' and public.is_verceti_staff())
);

drop policy if exists "Members manage own music favorites" on public.music_favorites;
create policy "Members manage own music favorites" on public.music_favorites
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Members read own or staff read all recommendations" on public.music_recommendations;
create policy "Members read own or staff read all recommendations" on public.music_recommendations
for select to authenticated
using (user_id = (select auth.uid()) or public.is_verceti_staff());
drop policy if exists "Members submit own recommendations" on public.music_recommendations;
create policy "Members submit own recommendations" on public.music_recommendations
for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists "Staff review music recommendations" on public.music_recommendations;
create policy "Staff review music recommendations" on public.music_recommendations
for update to authenticated
using (public.is_verceti_staff())
with check (public.is_verceti_staff());

-- ACTIVITY TRACKING
create table if not exists public.member_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_seconds bigint not null default 0 check (total_seconds >= 0),
  updated_at timestamptz not null default now()
);
alter table public.member_activity enable row level security;

drop policy if exists "Members read own activity" on public.member_activity;
create policy "Members read own activity" on public.member_activity
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Staff read all member activity" on public.member_activity;
create policy "Staff read all member activity" on public.member_activity
for select to authenticated using (public.is_verceti_staff());

create or replace function public.add_activity_seconds(seconds_to_add integer)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  v_user uuid := auth.uid();
  v_last_update timestamptz;
  v_elapsed integer;
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;
  if seconds_to_add is null or seconds_to_add < 1 or seconds_to_add > 60 then
    raise exception 'invalid_activity_increment';
  end if;

  -- Serialize updates and calculate time on the server, not from client input.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select updated_at
  into v_last_update
  from public.member_activity
  where user_id = v_user
  for update;

  if not found then
    insert into public.member_activity(user_id, total_seconds, updated_at)
    values (v_user, 0, clock_timestamp())
    on conflict (user_id) do nothing;
    return;
  end if;

  v_elapsed := floor(extract(epoch from (clock_timestamp() - v_last_update)))::integer;

  -- Ignore rapid/replayed calls and cap long idle gaps.
  if v_elapsed < 20 then
    return;
  end if;

  update public.member_activity
  set total_seconds = total_seconds + least(v_elapsed, 60),
      updated_at = clock_timestamp()
  where user_id = v_user;
end;
$$;
revoke all on function public.add_activity_seconds(integer) from public;
grant execute on function public.add_activity_seconds(integer) to authenticated;

create or replace function public.get_verceti_top_members()
returns table (
  user_id uuid,
  nickname text,
  role public.verceti_role,
  total_seconds bigint
)
language sql
stable
security definer
set search_path = public
as $
  select p.id, p.nickname, p.role, a.total_seconds
  from public.member_activity a
  join public.profiles p on p.id = a.user_id
  where coalesce(p.is_banned, false) = false
  order by a.total_seconds desc, p.nickname asc
  limit 10;
$$;
revoke all on function public.get_verceti_top_members() from public;
grant execute on function public.get_verceti_top_members() to authenticated;

-- Legacy moderation reference used by the admin account-deletion cleanup.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  action_type text not null default 'note',
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;

-- Missing application workflow RPCs referenced by server actions.
create or replace function public.resubmit_application(
  p_application_id uuid,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_application_answers';
  end if;

  update public.applications
  set answers = p_answers,
      status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      assigned_role = null,
      reviewer_note = null
  where id = p_application_id
    and user_id = auth.uid()
    and status = 'needs_changes';

  if not found then
    raise exception 'application_not_resubmittable';
  end if;
end;
$$;

create or replace function public.staff_update_application(
  p_application_id uuid,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_verceti_staff() then
    raise exception 'staff_only';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_application_answers';
  end if;

  update public.applications
  set answers = p_answers
  where id = p_application_id;

  if not found then
    raise exception 'application_not_found';
  end if;
end;
$$;

create or replace function public.delete_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_verceti_role() <> 'admin' then
    raise exception 'admin_only';
  end if;

  delete from public.applications where id = p_application_id;
  if not found then
    raise exception 'application_not_found';
  end if;
end;
$$;

revoke all on function public.resubmit_application(uuid, jsonb) from public;
revoke all on function public.staff_update_application(uuid, jsonb) from public;
revoke all on function public.delete_application(uuid) from public;
grant execute on function public.resubmit_application(uuid, jsonb) to authenticated;
grant execute on function public.staff_update_application(uuid, jsonb) to authenticated;
grant execute on function public.delete_application(uuid) to authenticated;

-- Updated-at triggers for editable content.
create or replace function public.site_features_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists application_questions_updated_at on public.application_questions;
create trigger application_questions_updated_at
before update on public.application_questions
for each row execute function public.site_features_set_updated_at();

drop trigger if exists community_rules_updated_at on public.community_rules;
create trigger community_rules_updated_at
before update on public.community_rules
for each row execute function public.site_features_set_updated_at();

drop trigger if exists tests_updated_at on public.tests;
create trigger tests_updated_at
before update on public.tests
for each row execute function public.site_features_set_updated_at();

-- Restrict table access; test tables are accessed only by server-side service-role actions.
revoke all on public.tests, public.test_questions, public.test_answers,
  public.test_permissions, public.test_results from anon, authenticated;
grant select, insert, update, delete on public.news, public.chat_messages,
  public.direct_messages, public.application_questions, public.community_rules,
  public.music_tracks, public.music_favorites, public.music_recommendations
to authenticated;
grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
revoke update on public.direct_messages from authenticated;
grant update (is_read) on public.direct_messages to authenticated;
grant select on public.member_activity to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Storage buckets used by chat and community media.
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('verceti-media', 'verceti-media', false)
on conflict (id) do update set public = false;

drop policy if exists "Members read media referenced by accessible messages" on storage.objects;
create policy "Members read media referenced by accessible messages" on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.chat_messages cm
      where position(name in cm.content) > 0
    )
    or exists (
      select 1
      from public.direct_messages dm
      where (dm.sender_id = (select auth.uid()) or dm.recipient_id = (select auth.uid()))
        and position(name in dm.content) > 0
    )
  )
);

drop policy if exists "Members upload own chat media" on storage.objects;
create policy "Members upload own chat media" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Members delete own chat media" on storage.objects;
create policy "Members delete own chat media" on storage.objects
for delete to authenticated
using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Members read allowed VERCETI media" on storage.objects;
create policy "Members read allowed VERCETI media" on storage.objects
for select to authenticated
using (
  bucket_id = 'verceti-media'
  and (
    (storage.foldername(name))[1] in ('members-photos', 'members-videos')
    or (
      (storage.foldername(name))[1] in ('management-photos', 'management-videos')
      and public.is_verceti_staff()
    )
  )
);
drop policy if exists "Members upload allowed VERCETI media" on storage.objects;
create policy "Members upload allowed VERCETI media" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'verceti-media'
  and (
    (storage.foldername(name))[1] in ('members-photos', 'members-videos')
    or (
      (storage.foldername(name))[1] in ('management-photos', 'management-videos')
      and public.is_verceti_staff()
    )
  )
);
drop policy if exists "Staff delete VERCETI media" on storage.objects;
create policy "Staff delete VERCETI media" on storage.objects
for delete to authenticated
using (
  bucket_id = 'verceti-media'
  and public.is_verceti_staff()
);

-- Realtime publication for live chat and live unread counters.
do $
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end;
$$;
do $
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end;
$$;

-- Realtime publication for live chat (ignore if already registered).
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end;
$$;

-- =========================================================
-- END VERCETI SITE FEATURES MIGRATION
-- =========================================================
