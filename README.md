# AutoTrack

Sistema universitario para gestionar vehículos y servicios de un taller.

## Arquitectura de tres capas

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Presentación | React y TypeScript | Formularios y vistas de administrador, mecánico y cliente. |
| Negocio | FastAPI | Autenticación, permisos, validaciones y operaciones del taller. |
| Datos | Supabase | PostgreSQL, Authentication y Storage. |

## Qué funciona

- Login, registro de clientes, renovación de sesión y cierre de sesión.
- Administrador: usuarios, vehículos, órdenes, asignación de mecánicos y resumen del taller.
- Mecánico: órdenes asignadas, diagnósticos, piezas, avances y fotografías.
- Cliente: registro de sus vehículos, seguimiento visual e historial con filtros de fecha, vehículo y servicio.

Las vistas consultan datos reales. Las fotografías requieren un bucket privado de Storage.

## Iniciar

Primera vez: sigue [Backend/README.md](Backend/README.md) para crear `.venv`, instalar dependencias y configurar Supabase.

Terminal del backend, desde la raíz:

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn FastApi.main:app --reload
```

Otra terminal, desde la raíz:

```powershell
npm install
npm run dev
```

- Aplicación: http://localhost:5173
- API y documentación interactiva: http://127.0.0.1:8000/docs
- Guía del frontend: [Frontend/README.md](Frontend/README.md)

Para detener cada servidor: **Ctrl+C**. Para desactivar el entorno: `deactivate`.

## Verificar antes de subir cambios

Desde la raíz:

```powershell
npm run build
```

Desde Backend, con `.venv` activo:

```powershell
python -m pip check
```

No subas `.env`, `.venv`, `node_modules` ni `dist`. Cada integrante configura su entorno.

tunelización

cloudflared tunnel --url http://localhost:5173
