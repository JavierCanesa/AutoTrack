# Iniciar el frontend

Necesitas Node.js 22.12 o superior de la rama 22 (el equipo actual usa 22.23.2).

Desde la raíz de AutoTrack, instala las dependencias una vez:

```powershell
npm install
```

Inicia React:

```powershell
npm run dev
```

También puedes ejecutar `npm run dev` desde `Frontend`.

Abre http://localhost:5173. Para detenerlo, presiona Ctrl+C.

Para consultar servicios, abre otra terminal y ejecuta desde la raíz:

```powershell
cd Backend
.\.venv\Scripts\python.exe -m uvicorn FastApi.main:app --reload
```

Configura `Backend/.env` siguiendo el README del backend. Vite envía las peticiones `/api` a FastAPI en el puerto 8000 durante desarrollo. Las claves de Supabase permanecen en el backend.

Comprueba TypeScript y genera los archivos del frontend:

```powershell
npm run build
```

El resultado queda en `Frontend/dist`. El proxy de Vite solo funciona en desarrollo; el alojamiento de producción necesitará configurar la ruta hacia la API.

## Login y registro

La página inicial usa `src/pages/AuthPage.tsx`, una vista compartida para ambos formularios.
El estilo toma la paleta azul oscuro y naranja del ZIP de Figma Make.

- Login: correo y contraseña.
- Registro de cliente: nombre, apellido, correo, teléfono opcional y confirmación de contraseña.
- Validación de campos requeridos, correo, mínimo de 8 caracteres al registrar y contraseñas coincidentes.
- Mostrar/ocultar contraseña y diseño adaptable a móvil.

El login se conecta con FastAPI y Supabase Auth. El registro todavía no crea cuentas.
Después del login se abre el panel correspondiente al rol del perfil. La sesión se guarda solo en memoria: recargar la página o cerrar sesión elimina el acceso local; no revoca otras sesiones de Supabase.
El catálogo de prueba sigue disponible en `/servicios`.

## Vistas por rol

`src/components/Dashboard.tsx` comparte menú, tarjetas, tabla, filtros y detalle.

- ADMIN: resumen, órdenes y carga por mecánico.
- MECHANIC: órdenes asignadas de ejemplo, trabajos completados y formulario local de avances.
- CLIENT: vehículos de ejemplo, seguimiento e historial.

Los datos se identifican como demostración y NO provienen de Supabase. Las ediciones son temporales.
La selección de ejemplos por rol es solo visual: los futuros endpoints deberán validar el usuario y sus permisos en el backend y RLS.
La referencia del ZIP se adaptó al alcance del proyecto; no se incluyeron facturación, pagos ni inventario.
