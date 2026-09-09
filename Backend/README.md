# AutoTrack API

## Conexión de prueba

Desde `Backend`, instala las dependencias en tu entorno virtual:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Completa `SUPABASE_URL` y `SUPABASE_KEY` en `.env` con los valores de tu proyecto.
Usa una clave publishable o anon para esta prueba. No compartas claves reales.
La configuración carga `Backend/.env` independientemente del directorio de ejecución.

```powershell
.\.venv\Scripts\python.exe -m uvicorn FastApi.main:app --reload
```

Abre http://127.0.0.1:8000/docs y ejecuta `GET /api/service-types`.
También puedes abrir http://127.0.0.1:8000/api/service-types.

El endpoint consulta exclusivamente `public.service_types` y devuelve una lista
con `id`, `name`, `description` y `created_at`, ordenada por nombre.
No inserta datos ni modifica tablas, funciones o políticas RLS.

- `200` con registros: la lectura funciona con la clave configurada.
- `200` con `[]`: no hay filas visibles; puede ser una tabla vacía o el efecto de RLS.
- `503`: falta configuración o sus valores no son válidos.
- `502`: falló la consulta; revisa URL, clave, existencia de la tabla y permisos.

Esta prueba no inicia sesión: utiliza los permisos de la clave configurada.
Si RLS requiere un usuario autenticado, la clave pública podría no mostrar filas.
No desactives RLS para forzar el resultado. Una clave service role omite RLS y no
sirve para comprobar permisos de clientes; nunca debe incluirse en React.

## Comparación con el modelo previsto

La estructura conserva routers, services, schemas y db dentro de FastApi.
Los módulos de usuarios, vehículos, órdenes y reportes todavía son archivos base;
no implementan ni verifican sus tablas, relaciones, triggers o funciones RPC.
Esta primera integración usa los cuatro campos documentados de service_types.
El esquema remoto solo podrá verificarse con acceso al proyecto Supabase.
