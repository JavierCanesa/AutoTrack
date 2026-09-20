# AutoTrack

Sistema web universitario para gestionar y dar seguimiento a vehículos en un taller mecánico. Contempla los roles de administrador, mecánico y cliente.

## Arquitectura de tres capas

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Presentación | React y TypeScript | Pantallas y peticiones HTTP. |
| Negocio | FastAPI y Python | API, validaciones y reglas de negocio. |
| Datos | Supabase y PostgreSQL | Persistencia; Supabase Auth y Storage para usuarios y fotografías. |

El backend se encuentra en `Backend/`. Actualmente incluye una ruta de bienvenida y una consulta de prueba a `public.service_types`. El frontend en `Frontend/` permite consultar ese catálogo.

## Iniciar el frontend

Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. Para consultar datos, inicia también FastAPI en otra terminal. Consulta los pasos en [Frontend/README.md](Frontend/README.md).

## Instalación y ejecución

La guía completa está en [Backend/README.md](Backend/README.md). Incluye:

- Requisitos y creación del entorno virtual `.venv`.
- Activación manual en PowerShell y ejecución sin activar el entorno.
- Instalación y verificación de dependencias.
- Configuración local de Supabase.
- Ejecución y pruebas en navegador, Swagger y Postman.
- Solución de errores frecuentes.

Cada integrante debe crear su propio entorno virtual y su archivo `.env`. No se comparten ni se suben a Git las carpetas `.venv` ni las credenciales.
