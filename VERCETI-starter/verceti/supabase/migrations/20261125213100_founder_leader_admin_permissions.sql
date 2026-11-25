update public.profiles set role = 'founder'::public.verceti_role where nickname = 'Gexon' and role = 'admin'::public.verceti_role;

create or replace function public.is_verceti_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
 select coalesce(public.current_verceti_role() in ('founder'::public.verceti_role,'admin'::public.verceti_role,'leader'::public.verceti_role,'moderator'::public.verceti_role),false);
$$;

create or replace function public.change_member_role(p_member_id uuid,p_new_role public.verceti_role,p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_actor_role public.verceti_role; v_old_role public.verceti_role;
begin
 v_actor_role:=public.current_verceti_role();
 if v_actor_role not in ('founder'::public.verceti_role,'admin'::public.verceti_role,'leader'::public.verceti_role) then raise exception 'Only founder or leader can change roles'; end if;
 select role into v_old_role from public.profiles where id=p_member_id for update;
 if not found then raise exception 'Member not found'; end if;
 if v_actor_role='leader'::public.verceti_role and (v_old_role in ('founder'::public.verceti_role,'admin'::public.verceti_role) or p_new_role in ('founder'::public.verceti_role,'admin'::public.verceti_role,'leader'::public.verceti_role)) then raise exception 'Leader cannot change founder/admin/leader assignments'; end if;
 if v_old_role=p_new_role then return; end if;
 update public.profiles set role=p_new_role where id=p_member_id;
 insert into public.role_history(member_id,changed_by,old_role,new_role,reason) values(p_member_id,auth.uid(),v_old_role,p_new_role,p_reason);
end;
$$;

create or replace function public.delete_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or public.current_verceti_role() not in ('founder'::public.verceti_role,'admin'::public.verceti_role,'leader'::public.verceti_role) then raise exception 'admin_or_leader_only'; end if;
 delete from public.applications where id=p_application_id;
 if not found then raise exception 'application_not_found'; end if;
end;
$$;

create or replace function public.admin_update_member_birthday(p_user_id uuid,p_birth_day smallint,p_birth_month smallint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or public.current_verceti_role() not in ('founder'::public.verceti_role,'admin'::public.verceti_role,'leader'::public.verceti_role) then raise exception 'forbidden'; end if;
 if p_birth_month<1 or p_birth_month>12 or p_birth_day<1 or p_birth_day>extract(day from (make_date(2000,p_birth_month,1)+interval '1 month - 1 day'))::int then raise exception 'invalid_birthday'; end if;
 update public.profiles set birth_day=p_birth_day,birth_month=p_birth_month where id=p_user_id;
 if not found then raise exception 'profile_not_found'; end if;
end;
$$;
