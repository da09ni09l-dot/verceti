-- VERCETI | Profile access and invited-account compatibility patch
-- Run in Supabase SQL Editor after schema.sql.
-- Safe to re-run.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

-- The app reads this flag to enforce account bans.
grant select (is_banned) on public.profiles to authenticated;

-- Use the nickname supplied by the admin when creating an invited Auth user.
-- The previous trigger ignored user_metadata.nickname and appended a UUID,
-- which made the nickname shown to the new member impossible to use at login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_nickname text;
begin
  base_nickname := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''),
    split_part(coalesce(new.email, 'member'), '@', 1)
  );

  base_nickname := regexp_replace(base_nickname, '[^a-zA-Z0-9_]', '', 'g');

  if base_nickname = '' then
    base_nickname := 'member';
  end if;

  insert into public.profiles (id, nickname, role)
  values (new.id, base_nickname, 'junior')
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Public profile game IDs are displayed on member profile pages.
grant select (game_id) on public.profiles to authenticated;
