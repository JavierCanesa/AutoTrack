# AutoTrack: iniciar el backend

Guía para Windows con PowerShell en VS Code. Ejecuta los comandos manualmente, uno por uno. Abrir este README no ejecuta ningún comando.

## 1. Requisitos

Instala Python 3.14 y abre la carpeta AutoTrack en VS Code.

Comprueba que Python esté disponible:

```powershell
python --version
```

Si `python` no se reconoce, prueba `py -3.14 --version`. En este equipo también puedes usar:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe" --version
```

## 2. Entrar a Backend

Abre **Terminal > Nueva terminal** y ejecuta:

```powershell
cd Backend
```

Si ya estás en Backend, omite este comando. Todos los pasos siguientes se ejecutan desde esa carpeta.

## 3. Crear .venv (solo la primera vez)

```powershell
python -m venv .venv
```

Si `python` no se reconoce, en este equipo usa:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe" -m venv .venv
```

Omite este paso si el entorno ya funciona. Si falta `pyvenv.cfg`, vuelve a crearlo con este comando desde Backend y reinstala las dependencias.

## 4. Activar .venv manualmente


```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea la activación:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

## 5. Instalar las dependencias

Con `.venv` activo:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Comprueba la instalación:

```powershell
python -m pip check
python -c "import fastapi, uvicorn, supabase; print('Dependencias disponibles')"
```

Repite la instalación cuando el equipo cambie `requirements.txt`.

## 6. Configurar Supabase

En VS Code, crea un archivo llamado `.env` dentro de Backend. Si ya existe, edítalo sin borrar tus valores.

Agrega la URL y la clave pública (publishable o anon) del proyecto:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-clave-publica
```

Reemplaza los ejemplos por tus datos reales. No subas `.env` a GitHub. Reinicia el servidor si cambias este archivo.

## 7. Iniciar el servidor

```powershell
python -m uvicorn FastApi.main:app --reload
```

Deja la terminal abierta mientras pruebas la API.

## 8. Probar

En el navegador: http://127.0.0.1:8000/docs.

En Postman:

1. Selecciona **GET**.
2. Escribe `http://127.0.0.1:8000/api/service-types`.
3. Pulsa **Send**. No necesitas body ni agregar las claves de Supabase.

## 9. Detener

Presiona **Ctrl+C** para detener el servidor. Después desactiva el entorno:

```powershell
deactivate
```

## Para trabajar otro día

Desde la raíz de AutoTrack, ejecuta manualmente:

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn FastApi.main:app --reload
```

Para React, abre **otra terminal**, ubicada en la raíz de AutoTrack:

```powershell
npm run dev
```

No ejecutes ambos servidores en la misma terminal. React abre en http://localhost:5173.

## Ejecutar sin activar .venv

Desde Backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn FastApi.main:app --reload
```

No necesitas crear `.venv` ni instalar todo nuevamente.

## Errores comunes

| Error | Solución |
| --- | --- |
| `py` no se reconoce | Instala Python y abre una terminal nueva. |
| No existe `Activate.ps1` | Entra a Backend y crea `.venv` con el paso 3. |
| Falta una biblioteca | Activa `.venv` e instala `requirements.txt`. |
| `No module named FastApi` | Ejecuta el servidor desde Backend. |
| Puerto 8000 ocupado | Detén el servidor anterior con Ctrl+C. |
| Respuesta `503` | Revisa las variables de Backend/.env. |
| Respuesta `502` | Revisa conexión, clave, tabla y permisos en Supabase. |
| Respuesta `[]` | Puede no haber datos o RLS no permite verlos; no desactives RLS. |

## Iniciar sesión

Usa una cuenta existente de Supabase Authentication y su contraseña. Debe tener un perfil en `public.profiles` con rol ADMIN, MECHANIC o CLIENT.
RLS debe permitir al usuario autenticado leer su propio perfil. No se modifican políticas desde el backend.

En Postman: `POST http://127.0.0.1:8000/api/auth/login`, Body > raw > JSON:

```json
{
  "email": "cliente2@autotrack.test",
  "password": "TU_CONTRASENA"
}
```

La respuesta incluye `access_token`, `expires_in` y `user`. No compartas el token ni guardes contraseñas reales en archivos del repositorio.

Para comprobar la sesión: `GET http://127.0.0.1:8000/api/auth/me`. En Authorization, selecciona Bearer Token y pega el `access_token` recibido.

- 401: credenciales incorrectas, cuenta sin confirmar o sesión inválida.
- 403: falta un perfil visible o su rol no es válido.
- 429: demasiados intentos; espera antes de repetir.
- 502/503: problema de conexión, configuración o permisos del perfil.

La sesión del frontend se mantiene solo en memoria y se descarta al recargar, al vencer o al pulsar Cerrar sesión. No hay renovación automática ni registro implementado en esta etapa.
