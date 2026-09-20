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
