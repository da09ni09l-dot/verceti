-- Allow every non-banned registered profile into the VERCETI community.
-- New public registrations receive the default junior role; existing staff roles are untouched.
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
  );
$function$;
