create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Сайт тимчасово оновлюється. Будь ласка, зайдіть пізніше.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "Anyone can read site maintenance setting" on public.site_settings;
create policy "Anyone can read site maintenance setting"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Only admins can insert site settings" on public.site_settings;
create policy "Only admins can insert site settings"
on public.site_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Only admins can update site settings" on public.site_settings;
create policy "Only admins can update site settings"
on public.site_settings for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);
