-- VERCETI | Profile access compatibility patch
-- Run once in Supabase SQL Editor after schema.sql.
-- Safe to re-run: the column is added only when missing.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

-- The application reads this flag to block banned users and display member status.
-- Keep all other profile columns restricted by the grants in schema.sql.
grant select (is_banned) on public.profiles to authenticated;
