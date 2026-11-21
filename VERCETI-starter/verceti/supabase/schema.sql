-- Базова схема VERCETI. Виконувати в Supabase SQL Editor.
-- Створення користувачів має бути лише через запрошення адміністратора.
create type public.verceti_role as enum ('admin', 'leader', 'moderator', 'senior', 'local', 'junior');
create type public.application_status as enum ('pending', 'needs_changes', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  game_id text unique,
  role public.verceti_role not null default 'junior',
  created_at timestamptz not null default now()
);

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

create table public.disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid not null references public.profiles(id),
  reason text not null,
  action_type text not null check (action_type in ('warning','restriction','ban','note')),
  created_at timestamptz not null default now()
);

create table public.role_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  old_role public.verceti_role,
  new_role public.verceti_role not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.disciplinary_actions enable row level security;
alter table public.role_history enable row level security;

-- Початкові політики навмисно обмежені: реальні права керівництва
-- потрібно додати через перевірені server-side функції/RPC, а не довіряти ролі з браузера.
create policy "Members can read basic profiles" on public.profiles
  for select to authenticated using (true);

create policy "Members can read own applications" on public.applications
  for select to authenticated using (auth.uid() = user_id);

create policy "Members can create own applications" on public.applications
  for insert to authenticated with check (auth.uid() = user_id);

-- Жодної загальної політики на зміну ролей/дисциплінарних записів немає.
-- Це захищає від самостійної зміни ролі через браузер до реалізації staff RPC.
