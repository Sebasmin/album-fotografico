// // Servidor sin dependencias: solo módulos incluidos en Node.js (requiere Node 18 o superior)
// const http = require('node:http');
// const https = require('node:https');
// const fs = require('node:fs');
// const path = require('node:path');
// const crypto = require('node:crypto');

// const PORT = process.env.PORT || 3000;
// const PUBLIC = __dirname;
// const UPLOADS = __dirname;
// const MAX_BYTES = 25 * 1024 * 1024; // 25 MB por foto
// fs.mkdirSync(UPLOADS, { recursive: true });

// // --- CONFIGURACIÓN GOOGLE DRIVE ---
// // Reemplaza esto con el ID de tu carpeta de Google Drive (sin el ?hl=es)
// const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1-KzlXMVETC3v1OcFt7hSwfdvAiErXJsN';

// // --- CONFIGURACIÓN OAUTH2 GOOGLE DRIVE ---
// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');
// let SERVICE_ACCOUNT = null;

// if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
//   try {
//     SERVICE_ACCOUNT = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
//     console.log('✅ Credenciales de Google Drive cargadas correctamente.');
//   } catch (e) {
//     console.error('❌ Error al leer service-account.json:', e.message);
//   }
// } else {
//   console.warn('⚠️ No se encontró "service-account.json". Las fotos solo se guardarán localmente.');
// }

// const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
// const MIME = {
//   '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
//   '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
// };

// const json = (res, code, data) => {
//   res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
//   res.end(JSON.stringify(data));
// };

// // --- AUTENTICACIÓN Y SUBIDA A GOOGLE DRIVE (SÓLO NODE.JS NATIVO) ---

// // Obtiene el Access Token mediante OAuth2 JWT usando crypto nativo
// function getGoogleAccessToken() {
//   return new Promise((resolve, reject) => {
//     if (!SERVICE_ACCOUNT) return reject(new Error('Sin credenciales de Google Drive'));

//     const now = Math.floor(Date.now() / 1000);
//     const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
//     const claimSet = Buffer.from(JSON.stringify({
//       iss: SERVICE_ACCOUNT.client_email,
//       scope: 'https://www.googleapis.com/auth/drive.file',
//       aud: SERVICE_ACCOUNT.token_uri,
//       exp: now + 3600,
//       iat: now,
//     })).toString('base64url');

//     const signatureInput = `${header}.${claimSet}`;
//     const signer = crypto.createSign('RSA-SHA256');
//     signer.update(signatureInput);
//     const signature = signer.sign(SERVICE_ACCOUNT.private_key, 'base64url');

//     const jwt = `${signatureInput}.${signature}`;
//     const postData = new URLSearchParams({
//       grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
//       assertion: jwt,
//     }).toString();

//     const req = https.request(SERVICE_ACCOUNT.token_uri, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'Content-Length': Buffer.byteLength(postData),
//       },
//     }, (res) => {
//       let body = '';
//       res.on('data', (chunk) => body += chunk);
//       res.on('end', () => {
//         if (res.statusCode === 200) resolve(JSON.parse(body).access_token);
//         else reject(new Error(`Error de autenticación con Google: ${body}`));
//       });
//     });

//     req.on('error', reject);
//     req.write(postData);
//     req.end();
//   });
// }

// // Sube el archivo guardado localmente a Google Drive mediante multipart/related
// function uploadFileToDrive(filePath, fileName, mimeType) {
//   return getGoogleAccessToken().then((accessToken) => {
//     return new Promise((resolve, reject) => {
//       const boundary = '-------' + crypto.randomBytes(16).toString('hex');
//       const delimiter = `\r\n--${boundary}\r\n`;
//       const closeDelimiter = `\r\n--${boundary}--`;

//       // Se especifica la carpeta padre
//       const metadata = {
//         name: fileName,
//         parents: [DRIVE_FOLDER_ID]
//       };

//       const multipartHeader = delimiter +
//         'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
//         JSON.stringify(metadata) +
//         delimiter +
//         `Content-Type: ${mimeType}\r\n\r\n`;

//       const stats = fs.statSync(filePath);
//       const contentLength = Buffer.byteLength(multipartHeader) + stats.size + Buffer.byteLength(closeDelimiter);

//       // Usamos el endpoint con supportsAllDrives y enforceSingleParent
//       const options = {
//         hostname: 'www.googleapis.com',
//         path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&enforceSingleParent=true',
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': `multipart/related; boundary=${boundary}`,
//           'Content-Length': contentLength,
//         },
//       };

//       const req = https.request(options, (res) => {
//         let body = '';
//         res.on('data', (chunk) => body += chunk);
//         res.on('end', () => {
//           if (res.statusCode === 200 || res.statusCode === 201) {
//             resolve(JSON.parse(body));
//           } else {
//             reject(new Error(`Error subida Drive: ${body}`));
//           }
//         });
//       });

//       req.on('error', reject);

//       req.write(multipartHeader);
//       const fileStream = fs.createReadStream(filePath);
//       fileStream.on('error', (err) => req.destroy(err));
//       fileStream.pipe(req, { end: false });
//       fileStream.on('end', () => {
//         req.end(closeDelimiter);
//       });
//     });
//   });
// }

// // GET /api/photos → fotos en orden cronológico (como un álbum)
// function listPhotos(res) {
//   fs.readdir(UPLOADS, (err, files) => {
//     if (err) return json(res, 500, { error: 'No se pudo leer el álbum' });
//     const photos = files
//       .filter((f) => Object.values(TYPES).includes(path.extname(f)))
//       .sort()
//       .map((name) => ({ name, url: `/uploads/${name}` }));
//     json(res, 200, photos);
//   });
// }

// // POST /api/photos → el cuerpo de la petición ES la imagen (una foto por petición)
// function savePhoto(req, res) {
//   const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
//   const ext = TYPES[contentType];
//   if (!ext) return json(res, 415, { error: 'Solo se aceptan imágenes JPG, PNG, WebP o GIF' });

//   const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
//   const file = path.join(UPLOADS, name);
//   const out = fs.createWriteStream(file);
//   let size = 0, aborted = false;

//   const abort = (code, error) => {
//     if (aborted) return;
//     aborted = true;
//     req.unpipe(out); out.destroy(); req.resume();
//     fs.unlink(file, () => {});
//     json(res, code, { error });
//   };

//   req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BYTES) abort(413, 'La foto pesa más de 25 MB'); });
//   req.on('error', () => abort(400, 'Subida interrumpida'));
//   out.on('error', () => abort(500, 'No se pudo guardar la foto'));

//   out.on('finish', () => {
//     if (!aborted) {
//       // 1. Respondemos inmediatamente al cliente web para mostrar la foto
//       json(res, 201, { name, url: `/uploads/${name}` });

//       // 2. Si hay credenciales de Google Drive, enviamos una copia a la nube
//       if (SERVICE_ACCOUNT) {
//         uploadFileToDrive(file, name, contentType)
//           .then(() => console.log(`☁️ Foto "${name}" sincronizada en Google Drive`))
//           .catch((err) => console.error('❌ Error al subir a Google Drive:', err.message));
//       }
//     }
//   });

//   req.pipe(out);
// }

// function serve(res, root, rel, immutable) {
//   if (!rel || rel.endsWith('/')) rel += 'index.html';
//   const file = path.join(root, rel);
//   if (!file.startsWith(root + path.sep)) return json(res, 403, { error: 'Prohibido' });

//   fs.stat(file, (err, st) => {
//     if (err || !st.isFile()) return json(res, 404, { error: 'No encontrado' });
//     res.writeHead(200, {
//       'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
//       'Content-Length': st.size,
//       'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
//       'X-Content-Type-Options': 'nosniff',
//     });
//     fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
//   });
// }

// http.createServer((req, res) => {
//   let pathname;
//   try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
//   catch { return json(res, 400, { error: 'URL inválida' }); }
//   if (pathname.includes('\0')) return json(res, 400, { error: 'URL inválida' });

//   if (pathname === '/api/photos') {
//     if (req.method === 'GET') return listPhotos(res);
//     if (req.method === 'POST') return savePhoto(req, res);
//     return json(res, 405, { error: 'Método no permitido' });
//   }
//   if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido' });
//   if (pathname.startsWith('/uploads/')) return serve(res, UPLOADS, pathname.slice(9), true);
//   serve(res, PUBLIC, pathname.slice(1), false);
// }).listen(PORT, '0.0.0.0', () => console.log(`Portal listo en http://localhost:${PORT}`));



// Servidor sin dependencias: solo módulos incluidos en Node.js (requiere Node 18 o superior)
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = __dirname;
const UPLOADS = __dirname;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB por foto
fs.mkdirSync(UPLOADS, { recursive: true });

// --- CONFIGURACIÓN GOOGLE DRIVE ---
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// --- CONFIGURACIÓN OAUTH2 GOOGLE DRIVE ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_ENABLED = Boolean(DRIVE_FOLDER_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

const PUBLIC_FILES = new Set([
  'album.html', 'album-fotos.html', 'album.js', 'common.js',
  'enviroment.js', 'styles.css', 'upload.js',
]);

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};

const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

// --- AUTENTICACIÓN Y SUBIDA A GOOGLE DRIVE (SÓLO NODE.JS NATIVO VÍA OAUTH2) ---

// Obtiene un Access Token usando el Refresh Token de tu cuenta de Google
function getGoogleAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString();

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body).access_token);
        } else {
          reject(new Error(`Error al renovar Token de Google: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Sube el archivo guardado localmente a Google Drive mediante multipart/related
function uploadFileToDrive(filePath, fileName, mimeType) {
  return getGoogleAccessToken().then((accessToken) => {
    return new Promise((resolve, reject) => {
      const boundary = '-------' + crypto.randomBytes(16).toString('hex');
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      // Se especifica la carpeta padre
      const metadata = {
        name: fileName,
        parents: [DRIVE_FOLDER_ID]
      };

      const multipartHeader = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`;

      const stats = fs.statSync(filePath);
      const contentLength = Buffer.byteLength(multipartHeader) + stats.size + Buffer.byteLength(closeDelimiter);

      const options = {
        hostname: 'www.googleapis.com',
        path: '/upload/drive/v3/files?uploadType=multipart',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': contentLength,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Error subida Drive: ${body}`));
          }
        });
      });

      req.on('error', reject);

      req.write(multipartHeader);
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => req.destroy(err));
      fileStream.pipe(req, { end: false });
      fileStream.on('end', () => {
        req.end(closeDelimiter);
      });
    });
  });
}

// GET /api/photos → fotos en orden cronológico (como un álbum)
function listPhotos(res) {
  fs.readdir(UPLOADS, (err, files) => {
    if (err) return json(res, 500, { error: 'No se pudo leer el álbum' });
    const photos = files
      .filter((f) => Object.values(TYPES).includes(path.extname(f)))
      .sort()
      .map((name) => ({ name, url: `/uploads/${name}` }));
    json(res, 200, photos);
  });
}

// POST /api/photos → el cuerpo de la petición ES la imagen (una foto por petición)
function savePhoto(req, res) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  const ext = TYPES[contentType];
  if (!ext) return json(res, 415, { error: 'Solo se aceptan imágenes JPG, PNG, WebP o GIF' });

  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  const file = path.join(UPLOADS, name);
  const out = fs.createWriteStream(file);
  let size = 0, aborted = false;

  const abort = (code, error) => {
    if (aborted) return;
    aborted = true;
    req.unpipe(out); out.destroy(); req.resume();
    fs.unlink(file, () => {});
    json(res, code, { error });
  };

  req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BYTES) abort(413, 'La foto pesa más de 25 MB'); });
  req.on('error', () => abort(400, 'Subida interrumpida'));
  out.on('error', () => abort(500, 'No se pudo guardar la foto'));

  out.on('finish', () => {
    if (!aborted) {
      // 1. Respondemos inmediatamente al cliente web para mostrar la foto
      json(res, 201, { name, url: `/uploads/${name}` });

      if (DRIVE_ENABLED) {
        console.log(`🔄 Sincronizando "${name}" con Google Drive...`);
        uploadFileToDrive(file, name, contentType)
          .then(() => console.log(`☁️ Foto "${name}" sincronizada en Google Drive`))
          .catch((err) => console.error('❌ Error al subir a Google Drive:', err.message));
      }
    }
  });

  req.pipe(out);
}

function serve(res, root, rel, immutable) {
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) return json(res, 403, { error: 'Prohibido' });

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: 'No encontrado' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return json(res, 400, { error: 'URL inválida' }); }
  if (pathname.includes('\0')) return json(res, 400, { error: 'URL inválida' });

  if (pathname === '/api/photos') {
    if (req.method === 'GET') return listPhotos(res);
    if (req.method === 'POST') return savePhoto(req, res);
    return json(res, 405, { error: 'Método no permitido' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido' });
  if (pathname.startsWith('/uploads/')) {
    const name = pathname.slice(9);
    if (!/^\d+-[a-f0-9]{6}\.(jpg|png|webp|gif)$/i.test(name)) {
      return json(res, 404, { error: 'No encontrado' });
    }
    return serve(res, UPLOADS, name, true);
  }

  const rel = pathname === '/' ? 'album-fotos.html' : pathname.slice(1);
  if (!PUBLIC_FILES.has(rel)) return json(res, 404, { error: 'No encontrado' });
  serve(res, PUBLIC, rel, false);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Portal listo en http://localhost:${PORT}`);
  if (!DRIVE_ENABLED) console.log('Google Drive no configurado; las fotos solo se guardarán localmente.');
});