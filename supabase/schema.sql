
-- =========================================================
-- VERCETI | SECURE DATABASE FOUNDATION
-- Для чистого встановлення в Supabase SQL Editor
-- =========================================================

-- 1. Ролі та статуси анкет
create type public.verceti_role as enum (
  'admin',
  'leader',
  'moderator',
  'senior',
  'local',
  'junior'
);

create type public.application_status as enum (
  'pending',
  'needs_changes',
  'approved',
  'rejected'
);

-- 2. Профілі учасників
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  game_id text unique,
  role public.verceti_role not null default 'junior',
  created_at timestamptz not null default now()
);

-- 3. Анкети
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  assigned_role public.verceti_role,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Дисциплінарні записи
create table public.disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid not null references public.profiles(id),
  reason text not null,
  action_type text not null check (
    action_type in ('warning', 'restriction', 'ban', 'note')
  ),
  created_at timestamptz not null default now()
);

-- 5. Історія зміни ролей
create table public.role_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  old_role public.verceti_role,
  new_role public.verceti_role not null,
  reason text,
  created_at timestamptz not null default now()
);

-- 6. Увімкнення RLS
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.disciplinary_actions enable row level security;
alter table public.role_history enable row level security;

-- 7. Функція отримання ролі поточного користувача
create or replace function public.current_verceti_role()
returns public.verceti_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
  limit 1;
$$;

-- 8. Перевірка персоналу
create or replace function public.is_verceti_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_verceti_role() in (
      'admin',
      'leader',
      'moderator'
    ),
    false
  );
$$;

-- 9. Автоматичне створення профілю після запрошення
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_nickname text;
begin
  base_nickname :=
    regexp_replace(
      split_part(coalesce(new.email, 'member'), '@', 1),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    );

  if base_nickname = '' then
    base_nickname := 'member';
  end if;

  insert into public.profiles (id, nickname, role)
  values (
    new.id,
    base_nickname || '_' || left(new.id::text, 8),
    'junior'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 10. Автоматичне оновлення часу зміни анкети
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger applications_updated_at
before update on public.applications
for each row execute procedure public.set_updated_at();

-- 11. Політики профілів
create policy "Authenticated can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Members can update own nickname"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- 12. Політики анкет
create policy "Members and staff can read applications"
on public.applications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_verceti_staff()
);

create policy "Members can create own pending applications"
on public.applications
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and assigned_role is null
  and reviewer_note is null
);

-- 13. Політики дисциплінарних записів
create policy "Members and staff can read disciplinary records"
on public.disciplinary_actions
for select
to authenticated
using (
  member_id = (select auth.uid())
  or public.is_verceti_staff()
);

create policy "Staff can create disciplinary records"
on public.disciplinary_actions
for insert
to authenticated
with check (
  issued_by = (select auth.uid())
  and public.is_verceti_staff()
);

-- 14. Політики історії ролей
create policy "Members and staff can read role history"
on public.role_history
for select
to authenticated
using (
  member_id = (select auth.uid())
  or public.is_verceti_staff()
);

-- 15. Безпечне розглядання анкет
create or replace function public.review_application(
  p_application_id uuid,
  p_status public.application_status,
  p_note text default null,
  p_assigned_role public.verceti_role default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.verceti_role;
begin
  actor_role := public.current_verceti_role();

  if actor_role not in ('admin', 'leader', 'moderator') then
    raise exception 'Недостатньо прав для перевірки анкети';
  end if;

  if p_assigned_role is not null then
    if actor_role = 'moderator' then
      raise exception 'Модератор не може призначати ролі';
    end if;

    if actor_role = 'leader' and p_assigned_role = 'admin' then
      raise exception 'Лідер не може призначати Адміна';
    end if;

    if p_status <> 'approved' then
      raise exception 'Роль можна призначити лише після схвалення анкети';
    end if;
  end if;

  update public.applications
  set
    status = p_status,
    reviewer_note = p_note,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    assigned_role = p_assigned_role
  where id = p_application_id;

  if not found then
    raise exception 'Анкету не знайдено';
  end if;

  if p_status = 'approved' and p_assigned_role is not null then
    update public.profiles
    set role = p_assigned_role
    where id = (
      select user_id
      from public.applications
      where id = p_application_id
    );
  end if;
end;
$$;

-- 16. Безпечна зміна ролі Адміном
create or replace function public.change_member_role(
  p_member_id uuid,
  p_new_role public.verceti_role,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.verceti_role;
  previous_role public.verceti_role;
begin
  actor_role := public.current_verceti_role();

  if actor_role <> 'admin' then
    raise exception 'Змінювати ролі може лише Адмін';
  end if;

  select role into previous_role
  from public.profiles
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Учасника не знайдено';
  end if;

  if previous_role = p_new_role then
    return;
  end if;

  update public.profiles
  set role = p_new_role
  where id = p_member_id;

  insert into public.role_history (
    member_id,
    changed_by,
    old_role,
    new_role,
    reason
  )
  values (
    p_member_id,
    auth.uid(),
    previous_role,
    p_new_role,
    p_reason
  );
end;
$$;

-- 17. Обмеження доступу до таблиць
revoke all on public.profiles from anon, authenticated;
revoke all on public.applications from anon, authenticated;
revoke all on public.disciplinary_actions from anon, authenticated;
revoke all on public.role_history from anon, authenticated;

-- Профілі: читання лише дозволених колонок
grant select (id, nickname, game_id, role, created_at)
on public.profiles to authenticated;

grant update (nickname)
on public.profiles to authenticated;

-- Анкети: учасник може створити лише власну анкету
grant select on public.applications to authenticated;
grant insert (user_id, answers)
on public.applications to authenticated;

-- Дисциплінарні записи
grant select, insert
on public.disciplinary_actions to authenticated;

-- Історія ролей доступна лише для читання
grant select on public.role_history to authenticated;

-- 18. Доступ до захищених функцій
revoke all on function public.current_verceti_role() from public;
revoke all on function public.is_verceti_staff() from public;
revoke all on function public.review_application(
  uuid, public.application_status, text, public.verceti_role
) from public;
revoke all on function public.change_member_role(
  uuid, public.verceti_role, text
) from public;

grant execute on function public.current_verceti_role()
to authenticated;

grant execute on function public.is_verceti_staff()
to authenticated;

grant execute on function public.review_application(
  uuid, public.application_status, text, public.verceti_role
) to authenticated;

grant execute on function public.change_member_role(
  uuid, public.verceti_role, text
) to authenticated;

-- =========================================================
-- КІНЕЦЬ СХЕМИ VERCETI
-- =========================================================
