-- Restore Founder access to maintenance mode and allow Founder to use/manage rewards.
drop policy if exists "Authenticated users can view active rewards prizes" on public.rewards_prizes;
create policy "Authenticated users can view active rewards prizes"
on public.rewards_prizes for select to authenticated
using (is_active or public.current_verceti_role() in ('founder', 'admin', 'leader'));

drop policy if exists "Leaders can add shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can add shared rewards prizes"
on public.rewards_prizes for insert to authenticated
with check (created_by = (select auth.uid()) and public.current_verceti_role() in ('founder', 'admin', 'leader'));

drop policy if exists "Leaders can update shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can update shared rewards prizes"
on public.rewards_prizes for update to authenticated
using (public.current_verceti_role() in ('founder', 'admin') or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid())))
with check (public.current_verceti_role() in ('founder', 'admin') or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid())));

drop policy if exists "Leaders can delete shared rewards prizes" on public.rewards_prizes;
create policy "Leaders can delete shared rewards prizes"
on public.rewards_prizes for delete to authenticated
using (public.current_verceti_role() in ('founder', 'admin') or (public.current_verceti_role() = 'leader' and created_by = (select auth.uid())));

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
      and (p.role in ('founder', 'admin', 'leader', 'moderator', 'senior', 'local') or (
        select a.status from public.applications a
        where a.user_id = p.id order by a.created_at desc limit 1
      ) = 'approved')
  ) then raise exception 'account_not_approved'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (select 1 from public.rewards_spins where user_id = v_user and spin_type = 'daily'
    and spun_at >= date_trunc('day', now()) and spun_at < date_trunc('day', now()) + interval '1 day') then
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
