# Frontend de AutoTrack

## Iniciar

Usa Node.js 22.12 o posterior de la rama 22.
Desde la raíz de AutoTrack:

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. Inicia también FastAPI en otra terminal.
Para detener React: **Ctrl+C**.

## Comprobar

```powershell
npm run build
```

Comprueba TypeScript y genera `Frontend/dist`.

## Pantallas

| Usuario | Opciones |
| --- | --- |
| Administrador | Resumen, vehículos, órdenes, mecánicos y usuarios. |
| Mecánico | Mi jornada, órdenes asignadas, diagnóstico, piezas, avances, fotografías e historial de trabajos. |
| Cliente | Seguimiento por vehículo, registro y edición de sus vehículos, servicios e historial con filtros. |

`AuthPage.tsx` reutiliza una vista para login y registro. El registro público crea clientes; solo un administrador asigna los demás roles.

La sesión se recupera al recargar mediante una cookie HttpOnly de renovación. El token de acceso queda en memoria; no se guardan contraseñas ni tokens en localStorage.
**Cerrar sesión** revoca la sesión actual y elimina la cookie.

## Archivos principales

- `src/components/Dashboard.tsx`: menú y selección de vistas por rol.
- `src/pages/MechanicPage.tsx`: jornada, contadores y trabajos asignados al mecánico.
- `src/pages/ClientPage.tsx`: seguimiento visual, vehículos y acceso a su historial.
- `src/components/ServiceList.tsx`: tarjetas y filtros compartidos por vehículo, fecha, servicio y estado.
- `src/components/ServiceProgress.tsx`: fase actual y explicación del estado del servicio.
- `src/pages/UsersPage.tsx`: gestión de cuentas y perfiles.
- `src/pages/VehiclesPage.tsx`: vehículos reales.
- `src/pages/OrdersPage.tsx`: listado y creación de órdenes.
- `src/pages/OrderDetail.tsx`: diagnóstico, piezas, avances y fotografías.
- `src/pages/ReportsPage.tsx`: resumen y carga por mecánico.
- `src/services/authService.ts`: login, registro y renovación.
- `src/services/workshopService.ts`: peticiones a FastAPI.
- `src/styles/`: estilos de acceso y del taller; `src/style.css`: estilos generales.

Las pantallas no contienen datos de demostración. Los permisos también se validan en FastAPI.

## Vistas según la documentación de AutoTrack

- **RF-03:** el cliente registra vehículos a su nombre y puede editar sus datos. No puede cambiar el propietario ni borrar un vehículo con órdenes.
- **RF-04 y RF-05:** el mecánico abre un trabajo asignado y usa las secciones Diagnóstico y piezas, Avances y Fotografías.
- **RF-06:** Seguimiento muestra el estado de cada vehículo y permite consultar avances y evidencias. Se vuelve a consultar la API cada 30 segundos mientras la vista está visible; no usa WebSockets.
- **RF-07 y RF-08:** el historial muestra servicios completados, entregados y cancelados con su estado explícito. Permite filtrar por vehículo, fechas, tipo de servicio y estado. Los cancelados no se cuentan como trabajos finalizados.

En el historial se filtra por fecha de finalización; si falta, se usa la fecha de ingreso. En trabajos activos se usa la fecha de ingreso.
Las fotografías se consultan al abrir su sección. El cliente puede verlas, pero no modificar el trabajo del mecánico.

Para probar: inicia sesión como mecánico, abre una orden asignada y registra un avance. Luego entra como el cliente propietario y consulta Seguimiento. Para imágenes se necesita el bucket privado indicado en Backend/README.md.

## Configuración

Vite envía `/api` a `http://127.0.0.1:8000` durante desarrollo.
El proxy conserva `Host` con `changeOrigin: false` para que FastAPI valide el origen del navegador. Si cambias esta configuración, reinicia Vite.
Las claves de Supabase van únicamente en `Backend/.env`.

Para producción, sirve frontend y `/api` bajo el mismo dominio con HTTPS y configura `COOKIE_SECURE=true` en el backend. Conserva el Host original en el proxy para la comprobación del origen.
El proxy de Vite no forma parte de los archivos compilados.

## Si algo falla

- Puerto 5173 ocupado: detén la otra instancia de Vite.
- Error de conexión: comprueba que FastAPI esté encendido.
- Registro: confirma el correo si Supabase lo solicita y luego inicia sesión.
- Fotografía: configura el bucket privado explicado en el README del backend.
- No aparecen registros: revisa las asignaciones y el propietario; cada rol ve solo los datos permitidos.
# Recepción y cotizaciones

Antes de probar estas pantallas, aplica `Backend/FastApi/db/workflow.sql` y después `Backend/FastApi/db/workflow_roles.sql` siguiendo el README del backend.

- **Mecánico:** botón **Recibir vehículo**. Busca al cliente por código y queda asignado a la orden automáticamente.
- **Cliente:** código de ocho caracteres en el dashboard. En el detalle del servicio puede descargar, aceptar o rechazar la cotización.
- **Administrador:** prepara y envía cotizaciones desde la orden. El resumen incluye marcas, clientes, mecánicos y cotizaciones pendientes.
- **Diagnóstico y piezas:** permite indicar síntomas y prioridad Alta, Media o Baja. La prioridad no sustituye el estado del servicio.

El código de cliente sirve para localizar su registro; el acceso sigue requiriendo correo y contraseña. Los permisos y totales se comprueban en el backend y la base de datos.

## Navegación por rol

- Administrador: Resumen, Vehículos, Órdenes de trabajo, Cotizaciones, Historial de servicios, Mecánicos y Usuarios.
- Mecánico: Mi jornada, Recibir vehículo e Historial de trabajos.
- Cliente: Seguimiento, Cotizaciones, Mis vehículos, Mis servicios e Historial de servicios.

Cotizaciones abre directamente la sección de presupuesto de cada orden. El historial comparte filtros. El cliente siempre utiliza la lista compacta; el historial del mecánico solo incluye trabajos completados y entregados. Los gráficos del resumen representan los datos de la API.

El rediseño está en la capa de presentación: `components`, `pages` y `styles`. Conserva los servicios HTTP del frontend, las reglas del backend y el almacenamiento de Supabase. No requiere nuevas dependencias.

En el portal del mecánico, la recepción se abre únicamente desde el menú. Después de buscar al cliente puede registrar un carro nuevo aunque otro de sus carros tenga una orden abierta. Los filtros de fecha y servicio se despliegan bajo «Más filtros» o «Filtrar por fechas o servicio».



Para la tunelización seguir los siguientes pasos:

-$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS = "wishing-readers-moments-miles.trycloudflare.com" (Sin el HTTPS)
-npm run dev


## Cambios del flujo

- Todos los roles tienen **Mi perfil** para editar nombre, apellido y teléfono.
- Recepción: cliente registrado, vehículo existente o nuevo; sin servicio ni motivo. El servicio se elige en el diagnóstico.
- Vehículos: marca y tipo separados, marcas frecuentes u Otra, placas P / M / C. El VIN existente se conserva, pero no aparece en el formulario.
- Mecánico: **Comenzar reparación** cuando el cliente acepta; **Finalizar trabajo** después de las pruebas.
- Administrador: diagnóstico, piezas y fotos de consulta; conserva entrega y cancelación.
- Las tarjetas de estados, marcas y mecánicos abren sus registros filtrados.
- Eliminar abre un diálogo con **Aceptar / Cancelar**.

## Pantalla del mecánico por etapas

1. **Recibido:** escribe los síntomas que cuenta el cliente y pulsa **Recibido · Iniciar diagnóstico**.
2. **Diagnóstico:** consulta los síntomas; guarda las fallas y el servicio, adjunta la foto y agrega las piezas necesarias con prioridad. Pulsa **Enviar a cotización**.
3. **Espera:** el administrador cotiza y el cliente decide. Cuando acepta, aparece **Comenzar reparación**.
4. **Reparación:** marca las piezas de la cotización aceptada, describe el trabajo y pulsa **Reparación lista · Pasar a pruebas**.
5. **Pruebas:** escribe el resultado, confirma el funcionamiento y pulsa **Finalizar · Listo para entregar**.

El administrador conserva la entrega. El mecánico no utiliza un selector de estados. El diagnóstico y el historial siguen disponibles como consulta.
