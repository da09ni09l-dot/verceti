-- Preserve existing accounts while requiring explicit approval for new registrations.
alter table public.profiles
  add column if not exists membership_approved boolean not null default true;

create or replace function public.is_verceti_member()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_banned = false
      and p.membership_approved = true
  );
$function$;

-- The existing review workflow remains authoritative: only an approved
-- application unlocks membership. Rejections and requests for changes stay gated.
create or replace function public.sync_application_membership_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status
     and new.status = 'approved' then
    update public.profiles
    set membership_approved = true
    where id = new.user_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_application_membership_approval
  on public.applications;

create trigger sync_application_membership_approval
after update of status on public.applications
for each row
execute function public.sync_application_membership_approval();

-- A member may edit their own profile, but cannot self-approve membership.
create or replace function public.prevent_self_membership_approval_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() = new.id
     and new.membership_approved is distinct from old.membership_approved then
    raise exception 'membership_approval_managed_by_application_review';
  end if;
  return new;
end;
$function$;

drop trigger if exists prevent_self_membership_approval_change
  on public.profiles;

create trigger prevent_self_membership_approval_change
before update of membership_approved on public.profiles
for each row
execute function public.prevent_self_membership_approval_change();
