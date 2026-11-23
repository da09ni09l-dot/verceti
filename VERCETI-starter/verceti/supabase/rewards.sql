-- VERCETI shared rewards roulette. Run once in Supabase SQL Editor.
create table if not exists public.rewards_prizes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  weight integer not null default 1 check (weight between 1 and 10000),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.rewards_spins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  prize_id uuid not null references public.rewards_prizes(id) on delete restrict,
  spun_at timestamptz not null default now()
);
alter table public.rewards_spins
  add column if not exists spin_type text not null default 'daily'
  check (spin_type in ('daily', 'weekly'));
create index if not exists rewards_spins_user_day_idx on public.rewards_spins (user_id, spun_at desc);
create index if not exists rewards_spins_user_type_idx on public.rewards_spins (user_id, spin_type, spun_at desc);
alter table public.rewards_prizes enable row level security;
alter table public.rewards_spins enable row level security;
drop policy if exists "Authenticated users can view active rewards prizes" on public.rewards_prizes;
create policy "Authenticated users can view active rewards prizes" on public.rewards_prizes for select to authenticated using (is_active or public.current_verceti_role() in ('admin','leader'));
drop policy if exists "Leaders can add shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can add shared rewards prizes" on public.rewards_prizes for insert to authenticated with check (created_by = (select auth.uid()) and public.current_verceti_role() in ('admin','leader'));
drop policy if exists "Leaders can update shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can update shared rewards prizes" on public.rewards_prizes for update to authenticated using (public.current_verceti_role() = 'admin' or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid()))) with check (public.current_verceti_role() = 'admin' or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid())));
drop policy if exists "Leaders can delete shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can delete shared rewards prizes" on public.rewards_prizes for delete to authenticated using (public.current_verceti_role() = 'admin' or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid())));
drop policy if exists "Users can view own rewards spins" on public.rewards_spins;
create policy "Users can view own rewards spins" on public.rewards_spins for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.rewards_prizes to authenticated;
grant select on public.rewards_spins to authenticated;
grant usage, select on sequence public.rewards_spins_id_seq to authenticated;
create or replace function public.spin_verceti_rewards()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_prize public.rewards_prizes%rowtype;
  v_total numeric;
  v_pick numeric;
  v_running numeric := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.is_banned = false
      and (p.role in ('admin', 'leader', 'moderator') or exists (
        select 1 from public.applications a where a.user_id = p.id and a.status = 'approved'
      ))
  ) then
    raise exception 'account_not_approved';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (select 1 from public.rewards_spins where user_id = v_user and spin_type = 'daily' and spun_at >= date_trunc('day', now()) and spun_at < date_trunc('day', now()) + interval '1 day') then
    raise exception 'daily_spin_used';
  end if;
  select coalesce(sum(weight), 0) into v_total from public.rewards_prizes where is_active = true;
  if v_total <= 0 then raise exception 'no_active_prizes'; end if;
  v_pick := random() * v_total;
  for v_prize in select * from public.rewards_prizes where is_active = true order by created_at, id loop
    v_running := v_running + v_prize.weight;
    if v_pick < v_running then
      insert into public.rewards_spins(user_id, prize_id, spin_type) values (v_user, v_prize.id, 'daily');
      return jsonb_build_object('id', v_prize.id, 'title', v_prize.title, 'description', v_prize.description);
    end if;
  end loop;
  raise exception 'prize_selection_failed';
end;
$$;
revoke all on function public.spin_verceti_rewards() from public;
grant execute on function public.spin_verceti_rewards() to authenticated;


create or replace function public.spin_verceti_weekly_rewards()
returns jsonb language plpgsql security definer set search_path = public as $weekly_reward$
declare
  v_user uuid := auth.uid();
  v_prize public.rewards_prizes%rowtype;
  v_total numeric;
  v_pick numeric;
  v_running numeric := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.is_banned = false
      and (p.role in ('admin', 'leader', 'moderator') or exists (
        select 1 from public.applications a where a.user_id = p.id and a.status = 'approved'
      ))
  ) then raise exception 'account_not_approved'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (
    select 1 from public.rewards_spins
    where user_id = v_user and spin_type = 'weekly'
      and spun_at >= date_trunc('week', now())
      and spun_at < date_trunc('week', now()) + interval '1 week'
  ) then raise exception 'weekly_spin_used'; end if;

  select coalesce(sum(weight), 0) into v_total
  from public.rewards_prizes where is_active = true;
  if v_total <= 0 then raise exception 'no_active_prizes'; end if;
  v_pick := random() * v_total;

  for v_prize in
    select * from public.rewards_prizes where is_active = true order by created_at, id
  loop
    v_running := v_running + v_prize.weight;
    if v_pick < v_running then
      insert into public.rewards_spins(user_id, prize_id, spin_type)
      values (v_user, v_prize.id, 'weekly');
      return jsonb_build_object('id', v_prize.id, 'title', v_prize.title, 'description', v_prize.description);
    end if;
  end loop;
  raise exception 'prize_selection_failed';
end;
$weekly_reward$;
revoke all on function public.spin_verceti_weekly_rewards() from public;
grant execute on function public.spin_verceti_weekly_rewards() to authenticated;
