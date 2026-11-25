-- Only the founder may edit submitted application answers.
create or replace function public.staff_update_application(
  p_application_id uuid,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_verceti_role() <> 'founder'::public.verceti_role then
    raise exception 'founder_only';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_application_answers';
  end if;
  update public.applications
  set answers = p_answers
  where id = p_application_id;
  if not found then raise exception 'application_not_found'; end if;
end;
$$;
