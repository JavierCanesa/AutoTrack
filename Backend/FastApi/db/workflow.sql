-- Ejecutar completo una vez en Supabase > SQL Editor. No borra datos.
-- Si hay dos órdenes abiertas del mismo vehículo, la transacción se cancela.
begin;

alter table public.service_updates add column if not exists actor_id uuid references public.profiles(id);

alter table public.profiles add column if not exists client_code varchar(8);
create unique index if not exists profiles_client_code_unique on public.profiles(client_code);
create or replace function public.assign_client_code() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and OLD.client_code is not null then
    NEW.client_code := OLD.client_code;
    return NEW;
  end if;
  perform pg_advisory_xact_lock(84261001);
  loop
    NEW.client_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists(select 1 from public.profiles where client_code = NEW.client_code);
  end loop;
  return NEW;
end $$;
drop trigger if exists profiles_client_code on public.profiles;
create trigger profiles_client_code before insert or update on public.profiles
for each row execute function public.assign_client_code();
update public.profiles set client_code = null where client_code is null;
alter table public.profiles alter column client_code set not null;

alter table public.work_order_parts add column if not exists priority text not null default 'MEDIUM'
  check (priority in ('HIGH','MEDIUM','LOW'));
alter table public.diagnoses add column if not exists symptoms text;
create unique index if not exists one_open_order_per_vehicle on public.work_orders(vehicle_id)
where status not in ('DELIVERED','CANCELLED');

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id),
  version integer not null check(version > 0),
  status text not null default 'DRAFT' check(status in ('DRAFT','SENT','ACCEPTED','REJECTED','SUPERSEDED')),
  items jsonb not null check(jsonb_typeof(items) = 'array'),
  total numeric(14,2) not null check(total >= 0),
  valid_until date not null,
  notes text,
  created_by uuid not null references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(work_order_id,version)
);
alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
grant all on public.quotes to service_role;

-- Una recepción crea orden y primer avance en la misma transacción.
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
   insert into vehicles(client_id,plate,brand,model,vehicle_year,color,vin)
   values(owner_id,upper(p_new_vehicle->>'plate'),p_new_vehicle->>'brand',p_new_vehicle->>'model',
     (p_new_vehicle->>'vehicle_year')::int,p_new_vehicle->>'color',p_new_vehicle->>'vin') returning id into vehicle_id;
 end if;
 insert into work_orders(vehicle_id,mechanic_id,service_type_id,description,status)
 values(vehicle_id,p_actor,p_service,p_description,'RECEIVED') returning * into result;
 insert into service_updates(work_order_id,mechanic_id,actor_id,status,comment)
 values(result.id,p_actor,p_actor,'RECEIVED','Vehículo recibido por el mecánico.');
 return result;
end $$;

-- Versiones y respuestas se serializan bloqueando la orden.
create or replace function public.quote_action(p_actor uuid, p_order uuid, p_action text,
 p_quote uuid default null, p_data jsonb default '{}') returns public.quotes
language plpgsql set search_path = public as $$
declare o public.work_orders; q public.quotes; actor_role text; next_version int; amount numeric;
begin
 select * into o from work_orders where id=p_order for update;
 if not found then raise exception 'Orden no encontrada'; end if;
 select role::text into actor_role from profiles where id=p_actor;
 if o.status not in ('DIAGNOSIS','WAITING_APPROVAL') then raise exception 'Cotiza durante diagnóstico o espera'; end if;
 if p_action='CREATE' then
   if actor_role is distinct from 'ADMIN' then raise exception 'Solo administrador'; end if;
   if not exists(select 1 from diagnoses where work_order_id=p_order) then raise exception 'Registra el diagnóstico'; end if;
   if (p_data->>'valid_until')::date < current_date then raise exception 'Vigencia vencida'; end if;
   if jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Detalle inválido'; end if;
   if exists(select 1 from jsonb_array_elements(p_data->'items') i where
     (i->>'quantity')::numeric <= 0 or (i->>'unit_price')::numeric < 0) then raise exception 'Importes inválidos'; end if;
   select sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric,2)) into amount
     from jsonb_array_elements(p_data->'items') i;
   select coalesce(max(version),0)+1 into next_version from quotes where work_order_id=p_order;
   update quotes set status='SUPERSEDED' where work_order_id=p_order and status in ('DRAFT','SENT');
   insert into quotes(work_order_id,version,items,total,valid_until,notes,created_by)
   values(p_order,next_version,p_data->'items',amount,(p_data->>'valid_until')::date,p_data->>'notes',p_actor) returning * into q;
 else
   select * into q from quotes where id=p_quote and work_order_id=p_order for update;
   if not found then raise exception 'Cotización no encontrada'; end if;
   if q.version <> (select max(version) from quotes where work_order_id=p_order) then raise exception 'Existe una versión nueva'; end if;
   if p_action='SEND' then
     if actor_role is distinct from 'ADMIN' or q.status <> 'DRAFT' then raise exception 'No se puede enviar'; end if;
     if q.valid_until < current_date then raise exception 'Vigencia vencida'; end if;
     update quotes set status='SENT' where id=q.id returning * into q;
     update work_orders set status='WAITING_APPROVAL',updated_at=now() where id=p_order;
     if o.mechanic_id is not null then
       insert into service_updates(work_order_id,mechanic_id,actor_id,status,comment)
       values(p_order,o.mechanic_id,p_actor,'WAITING_APPROVAL','Cotización enviada al cliente.');
     end if;
   elsif p_action in ('ACCEPT','REJECT') then
     if actor_role is distinct from 'CLIENT' or not exists(select 1 from vehicles where id=o.vehicle_id and client_id=p_actor)
       or q.status <> 'SENT' then raise exception 'No se puede responder'; end if;
     if p_action='ACCEPT' and q.valid_until < current_date then raise exception 'Cotización vencida'; end if;
     update quotes set status=case when p_action='ACCEPT' then 'ACCEPTED' else 'REJECTED' end,
       decided_by=p_actor,decided_at=now() where id=q.id returning * into q;
   else raise exception 'Acción inválida'; end if;
 end if;
 return q;
end $$;

-- Impide iniciar reparación si la versión más reciente no está aprobada.
create or replace function public.require_approved_quote() returns trigger
language plpgsql set search_path=public as $$
begin
 if NEW.status='IN_REPAIR' and OLD.status not in ('IN_REPAIR','TESTING') and
   (select status from quotes where work_order_id=NEW.id order by version desc limit 1) is distinct from 'ACCEPTED' then
   raise exception 'El cliente debe aprobar la cotización vigente';
 end if;
 return NEW;
end $$;
drop trigger if exists work_order_quote_guard on public.work_orders;
create trigger work_order_quote_guard before update on public.work_orders
for each row execute function public.require_approved_quote();

revoke all on function public.receive_vehicle(uuid,text,uuid,jsonb,uuid,text) from public,anon,authenticated;
revoke all on function public.quote_action(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_vehicle(uuid,text,uuid,jsonb,uuid,text) to service_role;
grant execute on function public.quote_action(uuid,uuid,text,uuid,jsonb) to service_role;
commit;
