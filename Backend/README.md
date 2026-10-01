# Backend de AutoTrack

## Activar recepción y cotizaciones


Esta actualización necesita un cambio de Supabase **antes de iniciar sesión**.

1. Abre Supabase → **SQL Editor → New query**.
2. Copia el contenido completo de `FastApi/db/workflow.sql` y pulsa **Run**.
3. Si avisa que hay órdenes abiertas duplicadas, revisa `work_orders`: un vehículo solo puede tener una orden distinta de `DELIVERED` o `CANCELLED`. Resuelve cada caso real; no borres su historial. Luego ejecuta el script completo otra vez. Si falla, la transacción no aplica cambios parciales.
4. En **Storage**, crea el bucket privado `evidence` si todavía no existe.
5. En una terminal ubicada en `Backend`, ejecuta:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn FastApi.main:app --reload
```

El script conserva las llaves UUID y los registros existentes. Añade códigos estables de ocho caracteres, síntomas, prioridad de piezas, cotizaciones y funciones transaccionales. No crea un inventario ni otro rol. Las cotizaciones y sus funciones solo son accesibles a través del backend con la clave administrativa.

## Probar el flujo nuevo

1. **Cliente:** inicia sesión y copia su código del dashboard.
2. **Mecánico:** pulsa **Recibir vehículo**, busca ese código, selecciona o registra el carro y confirma. La orden se asigna al mecánico que la recibe.
3. En **Avances**, pasa a diagnóstico. En **Diagnóstico y piezas**, registra síntomas, hallazgos, piezas y prioridad Alta/Media/Baja. Usa las notas para explicar esa prioridad.
4. Guarda un avance y adjunta sus fotografías en **Fotografías**.
5. **Administrador:** abre la orden → **Cotización**. Añade piezas y mano de obra, precios finales en USD, vigencia y condiciones. Guarda el borrador y pulsa **Enviar al cliente**.
6. **Cliente:** abre el servicio → **Cotización**. Descarga el PDF y acepta o rechaza la versión presentada.
7. **Mecánico:** actualiza el detalle y pasa a reparación solo después de la aprobación. Luego registra pruebas y trabajo completado.
8. **Administrador:** registra la entrega. Si el cliente rechaza la cotización, puede preparar una versión nueva o cancelar la orden según lo acordado.

Los borradores son inmutables: para corregirlos se crea otra versión. Una versión nueva bloquea el inicio de reparación hasta su aprobación. La respuesta del cliente no cambia automáticamente el estado a reparación. Durante reparación no se permite cambiar la cotización; las ampliaciones de alcance quedan para una siguiente etapa. No hay facturación, pagos ni control de stock.

## Endpoints nuevos

Todos requieren `Authorization: Bearer <access_token>`.

| Método | Ruta | Rol |
| --- | --- | --- |
| GET | `/api/work-orders/reception/client?code=ABCD1234` | Mecánico o administrador |
| POST | `/api/work-orders/reception` | Mecánico |
| GET | `/api/work-orders/{id}/quotes` | Dueño del vehículo, mecánico asignado o administrador |
| POST | `/api/work-orders/{id}/quotes` | Administrador |
| POST | `/api/work-orders/{id}/quotes/{quote_id}/send` | Administrador |
| POST | `/api/work-orders/{id}/quotes/{quote_id}/accept` | Dueño del vehículo |
| POST | `/api/work-orders/{id}/quotes/{quote_id}/reject` | Dueño del vehículo |
| GET | `/api/work-orders/{id}/quotes/{quote_id}/pdf` | Usuarios autorizados para esa cotización |

Los cuerpos de las peticiones están disponibles en `http://127.0.0.1:8000/docs`.

Guía para Windows y PowerShell. Ejecuta los comandos manualmente.

## 1. Requisitos

Instala Python 3.14 y Node.js 22.12 o posterior de la rama 22.

```powershell
python --version
node --version
```

Si Python no se reconoce, prueba `py -3.14 --version` y vuelve a abrir la terminal después de instalarlo.

## 2. Crear y activar el entorno

Desde la raíz de AutoTrack:

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Crear `.venv` solo es necesario la primera vez. Si ya estás en Backend, no repitas `cd Backend`.

Si PowerShell bloquea la activación:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

## 3. Instalar dependencias

Con `.venv` activo, desde Backend:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
```

## 4. Configurar Supabase

Crea o edita `Backend/.env`:

Puedes copiar `Backend/.env.example` como punto de partida. El archivo de ejemplo no contiene credenciales reales.

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_publica
SUPABASE_SECRET_KEY=tu_clave_secreta
COOKIE_SECURE=false
EVIDENCE_BUCKET=evidence
```

En Supabase: **Settings > API Keys**. Usa la clave publishable/anon en `SUPABASE_KEY` y la secret/service_role en `SUPABASE_SECRET_KEY`.
No compartas este archivo ni lo subas a GitHub. No pongas estas claves en React.
Reinicia FastAPI después de cambiar `.env`.

## 5. Iniciar FastAPI

```powershell
python -m uvicorn FastApi.main:app --reload
```

- Estado: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs

En otra terminal, desde la raíz de AutoTrack:

```powershell
npm install
npm run dev
```

Aplicación: http://localhost:5173.

## 6. Configurar registro y perfiles

En Supabase:

1. **Authentication > Sign In / Providers**: habilita el acceso con correo y el registro de usuarios.
2. Si está activa la confirmación de correo, el cliente debe abrir el enlace recibido antes de iniciar sesión.
3. **Authentication > URL Configuration**: usa `http://localhost:5173` como Site URL durante desarrollo. En producción, usa el dominio HTTPS real.
4. En `profiles`, conserva la relación `id → auth.users.id`. El campo `id` no debe generar un UUID independiente.
5. Conserva RLS activo. La política SELECT del propio perfil debe aplicarse a `authenticated`, con condición `(select auth.uid()) = id`.

El registro público envía nombre y apellido a Auth. En el primer login verificado, FastAPI crea el perfil faltante como CLIENT. Si un trigger ya creó el perfil, lo conserva. Nunca toma un rol enviado por el registro.
Si hay un trigger en `auth.users`, revisa que use `new.id` y los nombres de `raw_user_meta_data`; un trigger incorrecto puede bloquear el registro antes de que FastAPI complete el perfil.
Ese trigger debe asignar CLIENT al registro público: nunca debe aceptar el rol desde los metadatos enviados por el usuario.

Para crear administradores o mecánicos, entra como administrador en **Usuarios > Crear usuario**. El formulario crea Auth y profiles con el mismo ID.
Para cuentas ya existentes sin perfil: **Usuarios > Editar**.

## 7. Configurar fotografías una vez

En Supabase **Storage**:

1. Crea un bucket llamado `evidence`.
2. Deja **Public bucket desactivado**.
3. Si configuras restricciones, permite `image/jpeg`, `image/png` e `image/webp`, hasta 5 MB.

Si usas otro nombre, cambia `EVIDENCE_BUCKET` en `.env` y reinicia FastAPI.
La aplicación no crea ni cambia buckets automáticamente.
Las fotografías se suben después de registrar un avance y se consultan a través de FastAPI.

## 8. Flujo para probar el taller

1. Administrador: crea un cliente y un mecánico en Usuarios.
2. Crea un vehículo y selecciona el cliente.
3. Crea una orden, selecciona servicio y asigna mecánico.
4. Mecánico: inicia sesión, abre la orden y registra diagnóstico, piezas y avances.
5. Sube una fotografía a un avance.
6. Cliente: inicia sesión y revisa su vehículo, seguimiento e historial.
7. Administrador: consulta el resumen y entrega la orden cuando esté completada.

Estados: recibido → diagnóstico → reparación → pruebas → completado → entregado. Desde diagnóstico puede pasar por espera de aprobación. Las transiciones disponibles aparecen en el formulario.
Solo el administrador entrega o cancela. Una orden entregada o cancelada conserva su historial y ya no se modifica desde la aplicación.

## 9. Postman

Login: `POST http://127.0.0.1:8000/api/auth/login`, Body > raw > JSON:

```json
{
  "email": "tu_correo",
  "password": "tu_contrasena"
}
```

Copia `access_token` de la respuesta. Para los endpoints protegidos, usa **Authorization > Bearer Token**.

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | /api/auth/register | Registrar cliente con email, password, first_name, last_name y phone opcional |
| POST | /api/auth/refresh | Renovar con la cookie recibida al iniciar sesión |
| POST | /api/auth/logout | Cerrar la sesión actual |
| GET | /api/auth/me | Ver el usuario autenticado |
| GET | /api/service-types | Catálogo de servicios |
| GET / POST | /api/users | Listar / crear usuarios, solo ADMIN |
| GET / PUT / DELETE | /api/users/{id} | Consultar / editar perfil / eliminar cuenta lógicamente |
| GET / POST | /api/vehicles | Listar / crear vehículos |
| GET / PUT / DELETE | /api/vehicles/{id} | Consultar / editar / eliminar vehículo sin historial |
| GET / POST | /api/work-orders | Listar / crear órdenes |
| GET | /api/work-orders/{id} | Detalle e historial |
| PATCH | /api/work-orders/{id}/assignment | Asignar mechanic_id, solo ADMIN |
| POST | /api/work-orders/{id}/diagnoses | Registrar description |
| POST | /api/work-orders/{id}/parts | Registrar part_name, action REPAIR/REPLACE y notes opcional |
| POST | /api/work-orders/{id}/updates | Registrar status y comment |
| POST | /api/work-orders/{id}/updates/{update_id}/photos | Body form-data, campo file de tipo File |
| GET | /api/work-orders/{id}/photos/{photo_id} | Descargar evidencia autorizada |
| GET | /api/reports/summary | Resumen real, solo ADMIN |

Swagger muestra los campos completos de cada operación.

## 10. Permisos y conservación de datos

- ADMIN: usuarios, vehículos, órdenes, asignaciones, registro de trabajos e informes.
- MECHANIC: lectura y registro de trabajos en órdenes asignadas.
- CLIENT: registro y edición de sus propios vehículos, eliminación solo cuando no tienen historial y lectura de sus órdenes.

FastAPI valida el token con Auth y lee el rol real del perfil. Los servicios del taller usan la clave administrativa después de esas comprobaciones y filtran por propietario/asignación. Esa clave omite RLS: las comprobaciones del backend son obligatorias.
RLS sigue protegiendo accesos directos a Supabase. No concedas escritura pública ni permitas que un cliente cambie su propio role.

Eliminar usuarios conserva su perfil y sus relaciones mediante eliminación lógica de Auth. No se permite eliminar administradores ni la cuenta propia. Un vehículo con órdenes tampoco se elimina. El cambio de propietario se bloquea si tiene historial.
Un cliente nunca puede registrar, editar o eliminar vehículos de otra persona. FastAPI comprueba su identidad y la propiedad en cada operación; no basta con cambiar el UUID enviado desde el navegador.
Los tokens de acceso ya emitidos pueden seguir siendo válidos hasta expirar en accesos directos a Supabase.

Auth + perfil, estado + avance y Storage + fotografía usan peticiones separadas. Si falla la segunda parte, la API lo informa: actualiza el detalle antes de repetir. No existe una transacción única entre esos servicios. Una garantía transaccional entre estado y avance requeriría una función de base de datos, que no se añadió.

## 11. Verificación antes de publicar

Desde Backend, con `.venv` activo:

```powershell
python -m pip check
```

Desde la raíz:

```powershell
npm run build
```

## 12. Detener y trabajar otro día

Detener servidor: **Ctrl+C**.
Desactivar el entorno en la misma terminal, desde cualquier carpeta:

```powershell
deactivate
```

Otro día, desde la raíz:

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn FastApi.main:app --reload
```

Sin activar `.venv`, desde Backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn FastApi.main:app --reload
```

Para impedir activación automática en VS Code, configura `python.terminal.activateEnvironment` en `false` y `python-envs.terminal.autoActivationType` en `off`.

## Errores frecuentes

| Error | Qué revisar |
| --- | --- |
| Falta pyvenv.cfg o Activate.ps1 | Recrea `.venv` desde Backend y reinstala requirements.txt. |
| No module named FastApi | Ejecuta Uvicorn desde Backend. |
| Puerto ocupado | Detén la instancia anterior con Ctrl+C. |
| 401 | Contraseña incorrecta o sesión vencida. |
| 403 | Correo sin confirmar, rol sin permiso o perfil oculto por RLS. |
| 409 | Registro relacionado, transición inválida o fallo parcial; lee el mensaje. |
| 422 | Campos inválidos. Revisa el esquema en Swagger. |
| 502 / 503 | Conexión, claves, políticas o configuración de Storage. |
| Catálogo vacío | Revisa datos y política SELECT de service_types para anon. |

## Producción

Usa HTTPS, configura `COOKIE_SECURE=true` y sirve frontend y `/api` en el mismo dominio. El proxy debe conservar el Host original. La sesión usa una cookie HttpOnly y comprobación de origen.
Configura correo/SMTP y límites de solicitudes adecuados en Supabase. El proyecto no incluye un despliegue de producción automático.

### Catálogo del taller

El diagnóstico y la creación administrativa de órdenes consultan `GET /api/service-types/workshop`, disponible para ADMIN y MECHANIC con sesión válida. El router valida la sesión, el servicio comprueba el rol y la capa de datos consulta Supabase. No se necesita habilitar lectura pública de `service_types`.


para tunelizacion
.\.venv\Scripts\Activate.ps1
$env:COOKIE_SECURE = "true"
python -m uvicorn FastApi.main:app --reload
## Actualización de recepción y permisos por rol

1. En Supabase abre **SQL Editor → New query**.
2. Si todavía no aplicaste `FastApi/db/workflow.sql`, ejecútalo primero.
3. Copia y ejecuta **todo** `FastApi/db/workflow_roles.sql`.
4. Reinicia FastAPI y recarga el frontend.

La actualización conserva los registros existentes. Agrega el tipo de vehículo, permite recibir sin elegir servicio y crea la función que guarda el estado y su avance en una sola operación.

- Mecánico: recibe por código del cliente; selecciona el servicio al diagnosticar; inicia reparación tras la aprobación; finaliza después de las pruebas.
- Administrador: consulta diagnóstico, piezas y fotos; cotiza; entrega o cancela.
- Cliente: acepta o rechaza la cotización.
- Todos: editan nombre, apellido y teléfono desde **Mi perfil**.

El estado actual vive en `work_orders`. `service_updates` conserva el historial necesario para las fotos. Repetir el último estado con el mismo comentario no duplica el avance.

Pruebas locales de SQL, si tienes PGlite disponible (no es dependencia de la aplicación):

```powershell
node Backend/test_workflow_sql.mjs <ruta-al-modulo-pglite>
```

### Validaciones del flujo por etapas

- Diagnósticos, piezas y fotos: únicamente durante `DIAGNOSIS`, por el mecánico asignado.
- Solicitar cotización: requiere diagnóstico y al menos una foto.
- Iniciar reparación: requiere la cotización vigente aceptada.
- Pasar a pruebas: requiere confirmar las piezas de esa cotización y describir el trabajo.
- Finalizar: requiere el resultado de las pruebas.

Los síntomas y el trabajo realizado se guardan en `service_updates.comment`, dentro del historial existente. No se agregan tablas ni se necesita otra migración para esta pantalla; sigue siendo requisito tener aplicado `workflow_roles.sql`.
