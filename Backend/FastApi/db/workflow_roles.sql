-- Aplicar después de workflow.sql. Conserva los datos y las llaves existentes.
begin;
alter table public.work_orders alter column service_type_id drop not null;
alter table public.vehicles add column if not exists vehicle_type text
  check(vehicle_type in ('SEDAN','SUV','MOTORCYCLE','PICKUP','SPORT'));
alter table public.service_updates alter column mechanic_id drop not null;
alter table public.service_updates add column if not exists actor_id uuid references public.profiles(id);
create or replace function public.receive_vehicle(p_actor uuid, p_code text, p_vehicle uuid,
 p_new_vehicle jsonb, p_service uuid, p_description text) returns public.work_orders
language plpgsql set search_path = public as $$
declare owner_id uuid; vehicle_id uuid; result public.work_orders;
begin
 if not exists(select 1 from profiles where id=p_actor and role='MECHANIC') then
   raise exception 'Solo un mecánico puede recibir'; end if;
 select id into owner_id from profiles where client_code=p_code and role='CLIENT';
 if owner_id is null then raise exception 'Cliente no encontrado'; end if;
 if p_vehicle is not null then
   select id into vehicle_id from vehicles where id=p_vehicle and client_id=owner_id for update;
   if vehicle_id is null then raise exception 'El vehículo no pertenece al cliente'; end if;
 else
   insert into vehicles(client_id,plate,brand,model,vehicle_year,color,vin,vehicle_type)
   values(owner_id,upper(p_new_vehicle->>'plate'),p_new_vehicle->>'brand',p_new_vehicle->>'model',
     (p_new_vehicle->>'vehicle_year')::int,p_new_vehicle->>'color',p_new_vehicle->>'vin',p_new_vehicle->>'vehicle_type') returning id into vehicle_id;
 end if;
 insert into work_orders(vehicle_id,mechanic_id,service_type_id,description,status)
 values(vehicle_id,p_actor,p_service,p_description,'RECEIVED') returning * into result;
 insert into service_updates(work_order_id,mechanic_id,actor_id,status,comment)
 values(result.id,p_actor,p_actor,'RECEIVED','Vehículo recibido por el mecánico.');
 return result;
end $$;


create or replace function public.record_progress(p_actor uuid,p_order uuid,p_status text,p_comment text,p_expected text)
returns jsonb language plpgsql set search_path=public as $$
declare o work_orders; r text; last_update service_updates; next_status work_order_status;
begin
 select * into o from work_orders where id=p_order for update;
 if not found then raise exception 'Orden no encontrada'; end if;
 select role::text into r from profiles where id=p_actor;
 if r='MECHANIC' then
   if o.mechanic_id is distinct from p_actor or p_status in ('DELIVERED','CANCELLED') then raise exception 'Sin permiso'; end if;
 elsif r='ADMIN' then
   if p_status not in ('DELIVERED','CANCELLED') then raise exception 'Solo entrega o cancelación'; end if;
 else raise exception 'Sin permiso'; end if;
 if nullif(trim(p_comment),'') is null then raise exception 'Comentario requerido'; end if;
 next_status := p_status::work_order_status;
 select * into last_update from service_updates where work_order_id=p_order order by created_at desc,id desc limit 1;
 if o.status=next_status and last_update.status=next_status and last_update.comment=p_comment then
   return to_jsonb(last_update);
 end if;
 if o.status::text <> p_expected then raise exception 'El estado cambió; vuelve a consultar'; end if;
 if o.status in ('DELIVERED','CANCELLED') then raise exception 'Orden cerrada'; end if;
 if o.status <> next_status and not (
   (o.status='RECEIVED' and p_status in ('DIAGNOSIS','CANCELLED')) or
   (o.status='DIAGNOSIS' and p_status in ('WAITING_APPROVAL','CANCELLED')) or
   (o.status='WAITING_APPROVAL' and p_status in ('IN_REPAIR','CANCELLED')) or
   (o.status='IN_REPAIR' and p_status in ('TESTING','CANCELLED')) or
   (o.status='TESTING' and p_status in ('IN_REPAIR','COMPLETED','CANCELLED')) or
   (o.status='COMPLETED' and p_status='DELIVERED')
 ) then raise exception 'Transición no permitida'; end if;
 -- El trigger require_approved_quote comprueba la aprobación antes de reparar.
 update work_orders set status=next_status,updated_at=now(),
   completion_date=case when next_status='COMPLETED' then coalesce(completion_date,now()) else completion_date end
 where id=p_order;
 insert into service_updates(work_order_id,mechanic_id,actor_id,status,comment)
 values(p_order,o.mechanic_id,p_actor,next_status,p_comment) returning * into last_update;
 return to_jsonb(last_update);
end $$;
revoke all on function public.record_progress(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_progress(uuid,uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
