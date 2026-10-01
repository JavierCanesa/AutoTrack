-- AUTOTRACK - REINICIO DE DATOS PARA DEMOSTRACION
-- ADVERTENCIA: este script elimina de forma irreversible todos los datos
-- operativos y todas las cuentas de Supabase Authentication.
-- Conserva exclusivamente public.service_types y los tipos enum, incluido
-- public.work_order_status. Ejecutalo solo en el proyecto de demostracion.
--
-- Las fotografias del bucket NO deben borrarse con SQL. Vacia primero o
-- despues el bucket privado `evidence` desde Supabase Storage para eliminar
-- tanto los objetos como sus metadatos administrados por Storage.

begin;

-- Fallar sin aplicar cambios si la base no tiene la estructura esperada.
do $$
begin
  if to_regclass('public.service_types') is null then
    raise exception 'No existe public.service_types. Revisa que elegiste el proyecto correcto.';
  end if;
  if to_regclass('public.work_orders') is null
     or to_regclass('public.profiles') is null
     or to_regclass('auth.users') is null then
    raise exception 'La estructura de AutoTrack esta incompleta. No se elimino nada.';
  end if;
end $$;

-- Orden inverso de dependencias para no usar CASCADE sobre el catalogo.
delete from public.evidence_photos;
delete from public.quotes;
delete from public.work_order_parts;
delete from public.diagnoses;
delete from public.service_updates;
delete from public.work_orders;
delete from public.vehicles;
delete from public.profiles;

-- Supabase elimina en cascada identidades, sesiones, factores MFA y tokens
-- relacionados con estas cuentas. No se modifican tablas internas de esquema.
delete from auth.users;

-- Verificacion dentro de la transaccion: cualquier residuo cancela todo.
do $$
begin
  if exists(select 1 from public.evidence_photos)
     or exists(select 1 from public.quotes)
     or exists(select 1 from public.work_order_parts)
     or exists(select 1 from public.diagnoses)
     or exists(select 1 from public.service_updates)
     or exists(select 1 from public.work_orders)
     or exists(select 1 from public.vehicles)
     or exists(select 1 from public.profiles)
     or exists(select 1 from auth.users) then
    raise exception 'Quedaron registros relacionados. La transaccion fue cancelada.';
  end if;
end $$;

commit;

-- Debe conservar el catalogo y dejar el resto en cero.
select
  (select count(*) from public.service_types) as servicios_conservados,
  (select count(*) from auth.users) as usuarios,
  (select count(*) from public.vehicles) as vehiculos,
  (select count(*) from public.work_orders) as ordenes;

