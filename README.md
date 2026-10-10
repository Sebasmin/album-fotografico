# Album fotografico

Aplicacion web para subir fotos de un evento y verlas en un album compartido. El servidor usa solo modulos incluidos en Node.js; no necesita instalar dependencias.

## Requisitos

- Node.js 18 o superior

## Ejecutar en local

Desde la carpeta del proyecto:

```powershell
node server.js
```

Abre `http://localhost:3000`. El servidor tambien acepta el puerto indicado en la variable de entorno `PORT`.

Las fotos se guardan localmente en la carpeta del proyecto. La integracion con Google Drive es opcional; sin configurarla, el album sigue funcionando con almacenamiento local.

## Google Drive (opcional)

Configura estas variables de entorno antes de iniciar el servidor:

```powershell
$env:GOOGLE_DRIVE_FOLDER_ID = "ID_DE_LA_CARPETA"
$env:GOOGLE_CLIENT_ID = "CLIENT_ID"
$env:GOOGLE_CLIENT_SECRET = "CLIENT_SECRET"
$env:GOOGLE_REFRESH_TOKEN = "REFRESH_TOKEN"
node server.js
```

No guardes esos valores en el repositorio ni en archivos que vayas a publicar. Para un servidor alojado, configura las variables en el panel seguro del proveedor de hosting. El disco del servidor debe ser persistente si quieres conservar las fotos locales entre reinicios o despliegues.

### Usar secretos de GitHub

Si un workflow de GitHub Actions despliega la aplicacion, crea estos secretos en `Settings > Secrets and variables > Actions > New repository secret`:

- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

El workflow debe pasarlos al proceso Node como variables de entorno. Guardarlos en GitHub no los configura automaticamente en un hosting externo; si el servidor se ejecuta fuera de Actions, configura los mismos nombres en el panel seguro de ese hosting.

## Publicar el codigo en GitHub

1. Crea un repositorio vacio en GitHub.
2. Instala Git para Windows si el comando `git` no esta disponible.
3. Desde esta carpeta, revisa los archivos que se incluiran y publica el codigo:

```powershell
git init
git add .
git status
git commit -m "Preparar album fotografico"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Antes de confirmar la subida, verifica que no aparezcan credenciales, `service-account.json` ni fotos privadas. `.gitignore` evita agregar archivos locales nuevos, pero no quita archivos que ya estuvieran versionados.
Si `service-account.json` ya estaba versionado, quitalo del indice sin borrar tu copia local con `git rm --cached service-account.json`. Si una credencial ya se publico, revocala aunque luego borres el archivo o el commit.

GitHub guarda el codigo, pero GitHub Pages no puede ejecutar este servidor Node ni gestionar las subidas. Para usar el album en internet, despliega `server.js` en un proveedor que soporte Node.js y almacenamiento persistente.

## Seguridad

Las credenciales de Google que estuvieron incrustadas en el codigo deben revocarse y regenerarse antes de publicar o desplegar. Si alguna vez se subieron a Git, eliminarlas en un commit nuevo no las borra del historial: revocalas igualmente y limpia el historial antes de hacer publico el repositorio.
