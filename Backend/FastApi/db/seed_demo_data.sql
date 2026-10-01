-- AUTOTRACK - POBLADO DIRECTO PARA PRESENTACION
-- Ejecutar DESPUES de reset_demo_data.sql, workflow.sql y workflow_roles.sql.
-- No crea tablas auxiliares ni temporales. Inserta directamente en las tablas
-- reales: Auth, perfiles, vehiculos, ordenes, avances, diagnosticos, piezas y
-- cotizaciones.
--
-- Resultado: 1 administrador, 5 mecanicos, 15 clientes, 50 vehiculos y
-- 50 ordenes distribuidas entre todos los estados.
-- Contrasena temporal de TODAS las cuentas: DemoAutoTrack2026!
-- Las fotografias deben subirse desde AutoTrack para que existan tambien en
-- Supabase Storage; no se insertan referencias falsas en evidence_photos.

begin;

do $$
begin
  if not exists(select 1 from public.service_types) then
    raise exception 'El catalogo public.service_types esta vacio. Carga los servicios antes de poblar la presentacion.';
  end if;
  if exists(select 1 from auth.users where email like '%.demo@autotrack.test')
     or exists(select 1 from public.work_orders where id::text like '50000000-%') then
    raise exception 'Los datos de presentacion ya existen. Ejecuta primero reset_demo_data.sql.';
  end if;
end $$;

-- 21 cuentas confirmadas en Supabase Authentication.
with
admin_user(id,email,password,first_name,last_name,phone) as (
  values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    'admin.demo@autotrack.test',
    'DemoAutoTrack2026!',
    'Andrea','Mendoza','2200-0001'
  )
),
mechanics as (
  select
    ('20000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
    format('mecanico%s.demo@autotrack.test',i),
    'DemoAutoTrack2026!',
    (array['Carlos','Miguel','Jose','Daniel','Roberto'])[i],
    (array['Ramirez','Hernandez','Martinez','Lopez','Castillo'])[i],
    format('7100-%s',lpad(i::text,4,'0'))
  from generate_series(1,5) as series(i)
),
clients as (
  select
    ('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
    format('cliente%s.demo@autotrack.test',i),
    'DemoAutoTrack2026!',
    (array['Ana','Luis','Maria','Fernando','Sofia','Diego','Elena','Jorge','Valeria','Ricardo','Gabriela','Oscar','Patricia','Manuel','Claudia'])[i],
    (array['Garcia','Perez','Rodriguez','Flores','Gonzalez','Rivera','Vasquez','Reyes','Cruz','Morales','Rivas','Torres','Aguilar','Santos','Romero'])[i],
    format('7000-%s',lpad(i::text,4,'0'))
  from generate_series(1,15) as series(i)
),
people as (
  select * from admin_user
  union all select * from mechanics
  union all select * from clients
)
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  lower(email),
  extensions.crypt(password,extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name',first_name,'last_name',last_name,'phone',phone),
  now(),now(),'','','',''
from people;

-- Crea la identidad de correo. La rama se adapta a versiones nuevas y
-- antiguas de auth.identities sin usar tablas auxiliares.
do $identities$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='auth' and table_name='identities' and column_name='provider_id'
  ) then
    execute $sql$
      insert into auth.identities (
        id,provider_id,user_id,identity_data,provider,
        last_sign_in_at,created_at,updated_at
      )
      select
        gen_random_uuid(),id::text,id,
        jsonb_build_object('sub',id::text,'email',lower(email),'email_verified',true),
        'email',now(),now(),now()
      from auth.users
      where email like '%.demo@autotrack.test'
      on conflict do nothing
    $sql$;
  else
    execute $sql$
      insert into auth.identities (
        id,user_id,identity_data,provider,
        last_sign_in_at,created_at,updated_at
      )
      select
        id::text,id,
        jsonb_build_object('sub',id::text,'email',lower(email),'email_verified',true),
        'email',now(),now(),now()
      from auth.users
      where email like '%.demo@autotrack.test'
      on conflict do nothing
    $sql$;
  end if;
end
$identities$;

-- Completa o corrige perfiles creados por cualquier trigger de Auth.
insert into public.profiles(id,first_name,last_name,phone,role,updated_at)
select
  id,
  raw_user_meta_data->>'first_name',
  raw_user_meta_data->>'last_name',
  raw_user_meta_data->>'phone',
  case
    when email='admin.demo@autotrack.test' then 'ADMIN'::public.user_role
    when email like 'mecanico%.demo@autotrack.test' then 'MECHANIC'::public.user_role
    else 'CLIENT'::public.user_role
  end,
  now()
from auth.users
where email like '%.demo@autotrack.test'
on conflict(id) do update set
  first_name=excluded.first_name,
  last_name=excluded.last_name,
  phone=excluded.phone,
  role=excluded.role,
  updated_at=excluded.updated_at;

-- 50 vehiculos, uno por cada orden para respetar la restriccion de una sola
-- orden abierta por vehiculo.
insert into public.vehicles(
  id,client_id,plate,brand,model,vehicle_year,color,vin,vehicle_type
)
select
  ('40000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  ('30000000-0000-4000-8000-' || lpad((1+((i-1)%15))::text,12,'0'))::uuid,
  format('P %s-%s',lpad(i::text,3,'0'),lpad(i::text,3,'0')),
  (array['TOYOTA','NISSAN','HONDA','HYUNDAI','KIA','MAZDA','MITSUBISHI','SUZUKI','FORD','CHEVROLET'])[1+((i-1)%10)],
  (array['Corolla','Sentra','Civic','Elantra','Rio','Mazda 3','Lancer','Swift','Escape','Tracker'])[1+((i-1)%10)],
  2014+((i-1)%13),
  (array['Blanco','Negro','Gris','Azul','Rojo','Plateado'])[1+((i-1)%6)],
  '3HGBH41JXMN' || lpad(i::text,6,'0'),
  (array['SEDAN','SUV','PICKUP','SPORT'])[1+((i-1)%4)]
from generate_series(1,50) as series(i);

-- 50 ordenes repartidas entre todos los estados del flujo.
with catalog as (
  select array_agg(id order by id) as ids from public.service_types
),
orders_to_insert as (
  select
    i,
    ('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid as id,
    ('40000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid as vehicle_id,
    ('20000000-0000-4000-8000-' || lpad((1+((i-1)%5))::text,12,'0'))::uuid as mechanic_id,
    catalog.ids[1+((i-1)%array_length(catalog.ids,1))] as service_type_id,
    (array['RECEIVED','DIAGNOSIS','WAITING_APPROVAL','IN_REPAIR','TESTING','COMPLETED','DELIVERED','CANCELLED'])[1+((i-1)%8)] as status,
    now()-((51-i)*interval '2 days') as entry_date
  from generate_series(1,50) as series(i)
  cross join catalog
)
insert into public.work_orders(
  id,vehicle_id,mechanic_id,service_type_id,description,
  status,entry_date,completion_date,updated_at
)
select
  id,vehicle_id,mechanic_id,service_type_id,
  format('Revision programada para presentacion. Caso numero %s.',i),
  status::public.work_order_status,
  entry_date,
  case when status in ('COMPLETED','DELIVERED') then entry_date+interval '4 days' end,
  greatest(entry_date,now()-interval '1 hour')
from orders_to_insert;

-- Avance inicial de recepcion para las 50 ordenes.
with source as (
  select i,o.*
  from generate_series(1,50) as series(i)
  join public.work_orders o
    on o.id=('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
)
insert into public.service_updates(
  id,work_order_id,mechanic_id,actor_id,status,comment,created_at
)
select
  ('70000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  id,mechanic_id,mechanic_id,'RECEIVED'::public.work_order_status,
  'Vehiculo recibido y registrado para la presentacion.',entry_date
from source;

-- Avance que representa el estado actual.
with source as (
  select i,o.*,o.status::text as status_text
  from generate_series(1,50) as series(i)
  join public.work_orders o
    on o.id=('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
)
insert into public.service_updates(
  id,work_order_id,mechanic_id,actor_id,status,comment,created_at
)
select
  ('71000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  id,
  mechanic_id,
  case when status_text in ('WAITING_APPROVAL','DELIVERED','CANCELLED')
       then '10000000-0000-4000-8000-000000000001'::uuid else mechanic_id end,
  status,
  case status_text
    when 'DIAGNOSIS' then 'Sintomas reportados: ruido y vibracion durante la conduccion.'
    when 'WAITING_APPROVAL' then 'Diagnostico enviado y cotizacion disponible para el cliente.'
    when 'IN_REPAIR' then 'Reparacion autorizada y trabajo en proceso.'
    when 'TESTING' then 'Reparacion finalizada; se realizan pruebas de funcionamiento.'
    when 'COMPLETED' then 'Pruebas superadas. Vehiculo listo para entregar.'
    when 'DELIVERED' then 'Vehiculo entregado al cliente en buenas condiciones.'
    when 'CANCELLED' then 'Orden cancelada por solicitud del cliente.'
  end,
  entry_date+interval '1 day'
from source
where status_text<>'RECEIVED';

-- Diagnosticos para las 43 ordenes que avanzaron de recepcion.
with source as (
  select i,o.*,o.status::text as status_text
  from generate_series(1,50) as series(i)
  join public.work_orders o
    on o.id=('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
)
insert into public.diagnoses(
  id,work_order_id,mechanic_id,description,symptoms,created_at
)
select
  ('80000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  id,mechanic_id,
  case when i%3=0 then 'Desgaste en componentes de freno y ajuste preventivo requerido.'
       when i%3=1 then 'Nivel de fluidos bajo y mantenimiento general pendiente.'
       else 'Vibracion causada por desalineacion y desgaste irregular.' end,
  'El cliente reporta ruido, vibracion o perdida de rendimiento.',
  entry_date+interval '12 hours'
from source
where status_text<>'RECEIVED';

-- Piezas para una parte de las ordenes; las restantes representan servicios
-- que solo requieren mano de obra.
with source as (
  select i,o.*,o.status::text as status_text
  from generate_series(1,50) as series(i)
  join public.work_orders o
    on o.id=('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
)
insert into public.work_order_parts(
  id,work_order_id,part_name,action,notes,priority,created_at
)
select
  ('90000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  id,
  case when i%3=0 then 'Pastillas de freno'
       when i%3=1 then 'Filtro de aceite'
       else 'Buje de suspension' end,
  (case when i%4=0 then 'REPAIR' else 'REPLACE' end)::public.part_action,
  'Pieza incluida para mostrar prioridad y alcance del trabajo.',
  case when i%3=0 then 'HIGH' when i%3=1 then 'MEDIUM' else 'LOW' end,
  entry_date+interval '18 hours'
from source
where status_text<>'RECEIVED' and i%2=0;

-- Cotizaciones coherentes con el estado actual. Reparacion, pruebas, terminado
-- y entregado siempre tienen una cotizacion aceptada.
with source as (
  select i,o.*,o.status::text as status_text,v.client_id
  from generate_series(1,50) as series(i)
  join public.work_orders o
    on o.id=('50000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
  join public.vehicles v on v.id=o.vehicle_id
)
insert into public.quotes(
  id,work_order_id,version,status,items,total,valid_until,notes,
  created_by,decided_by,decided_at,created_at
)
select
  ('60000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  id,
  1,
  case
    when status_text='DIAGNOSIS' then 'DRAFT'
    when status_text='WAITING_APPROVAL' and i%3=0 then 'SENT'
    when status_text='WAITING_APPROVAL' and i%3=1 then 'ACCEPTED'
    when status_text='WAITING_APPROVAL' then 'REJECTED'
    when status_text='CANCELLED' then 'REJECTED'
    else 'ACCEPTED'
  end,
  jsonb_build_array(
    jsonb_build_object('kind','PART','description','Repuesto principal','quantity',1,'unit_price',125+i),
    jsonb_build_object('kind','LABOR','description','Mano de obra especializada','quantity',1,'unit_price',45)
  ),
  170+i,
  current_date+30,
  'Cotizacion de presentacion con repuesto, mano de obra y garantia del servicio.',
  '10000000-0000-4000-8000-000000000001'::uuid,
  case
    when status_text in ('IN_REPAIR','TESTING','COMPLETED','DELIVERED','CANCELLED')
         or (status_text='WAITING_APPROVAL' and i%3<>0)
    then client_id end,
  case
    when status_text in ('IN_REPAIR','TESTING','COMPLETED','DELIVERED','CANCELLED')
         or (status_text='WAITING_APPROVAL' and i%3<>0)
    then entry_date+interval '2 days' end,
  entry_date+interval '1 day'
from source
where status_text<>'RECEIVED';

commit;

-- Debe mostrar 21 usuarios, 21 perfiles, 50 vehiculos, 50 ordenes y
-- 43 cotizaciones.
select
  (select count(*) from auth.users where email like '%.demo@autotrack.test') as usuarios,
  (select count(*) from public.profiles p join auth.users u on u.id=p.id
   where u.email like '%.demo@autotrack.test') as perfiles,
  (select count(*) from public.vehicles where id::text like '40000000-%') as vehiculos,
  (select count(*) from public.work_orders where id::text like '50000000-%') as ordenes,
  (select count(*) from public.quotes where id::text like '60000000-%') as cotizaciones;

-- Listado de acceso. Todas las cuentas usan DemoAutoTrack2026!
select
  u.email,p.role,p.first_name,p.last_name,p.client_code
from auth.users u
join public.profiles p on p.id=u.id
where u.email like '%.demo@autotrack.test'
order by
  case p.role::text when 'ADMIN' then 1 when 'MECHANIC' then 2 else 3 end,
  u.email;

