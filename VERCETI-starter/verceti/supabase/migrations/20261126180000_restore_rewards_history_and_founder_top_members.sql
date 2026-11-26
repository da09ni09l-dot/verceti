-- Restore community-visible roulette history and include Founder in the activity ranking.
drop policy if exists "Authenticated members can view community rewards history" on public.rewards_spins;
create policy "Authenticated members can view community rewards history"
on public.rewards_spins
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.is_banned = false
  )
);

create or replace function public.get_verceti_top_members()
returns table (
  user_id uuid,
  nickname text,
  role text,
  total_seconds bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nickname, p.role::text, a.total_seconds
  from public.member_activity a
  join public.profiles p on p.id = a.user_id
  where coalesce(p.is_banned, false) = false
    and exists (
      select 1
      from public.profiles current_profile
      where current_profile.id = auth.uid()
        and current_profile.is_banned = false
        and (
          current_profile.role in ('founder', 'admin', 'leader', 'moderator', 'senior', 'local')
          or (
            select current_application.status
            from public.applications current_application
            where current_application.user_id = current_profile.id
            order by current_application.created_at desc
            limit 1
          ) = 'approved'
        )
    )
  order by a.total_seconds desc, p.nickname asc
  limit 10;
$$;

revoke all on function public.get_verceti_top_members() from public;
grant execute on function public.get_verceti_top_members() to authenticated;
