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
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB por foto

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

function driveRequest(accessToken, options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'www.googleapis.com',
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });

    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function listPhotos(res) {
  if (!DRIVE_ENABLED) return json(res, 503, { error: 'Google Drive no está configurado' });

  try {
    const accessToken = await getGoogleAccessToken();
    const photos = [];
    let pageToken;

    do {
      const params = new URLSearchParams({
        q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
        pageSize: '1000',
        orderBy: 'createdTime',
        fields: 'nextPageToken,files(id,name,mimeType,createdTime)',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await driveRequest(accessToken, {
        path: `/drive/v3/files?${params}`,
        method: 'GET',
      });
      if (response.statusCode !== 200) throw new Error(response.body.toString());

      const page = JSON.parse(response.body.toString());
      photos.push(...(page.files || [])
        .filter((file) => Object.hasOwn(TYPES, file.mimeType))
        .map((file) => ({ name: file.name, url: `/api/photos/${file.id}` })));
      pageToken = page.nextPageToken;
    } while (pageToken);

    json(res, 200, photos);
  } catch (error) {
    console.error('Error al consultar Google Drive:', error.message);
    json(res, 502, { error: 'No se pudo consultar Google Drive' });
  }
}

function readImage(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BYTES) {
        const error = new Error('La foto pesa más de 25 MB');
        error.statusCode = 413;
        fail(error);
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', fail);
    req.on('aborted', () => fail(new Error('Subida interrumpida')));
  });
}

async function savePhoto(req, res) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!Object.hasOwn(TYPES, contentType)) {
    req.resume();
    return json(res, 415, { error: 'Solo se aceptan imágenes JPG, PNG, WebP o GIF' });
  }
  if (!DRIVE_ENABLED) {
    req.resume();
    return json(res, 503, { error: 'Google Drive no está configurado' });
  }

  const contentLength = Number(req.headers['content-length']);
  if (contentLength > MAX_BYTES) {
    req.resume();
    return json(res, 413, { error: 'La foto pesa más de 25 MB' });
  }

  try {
    const image = await readImage(req);
    if (!image.length) return json(res, 400, { error: 'La imagen está vacía' });

    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${TYPES[contentType]}`;
    const accessToken = await getGoogleAccessToken();
    const boundary = `album-${crypto.randomBytes(16).toString('hex')}`;
    const metadata = JSON.stringify({ name, parents: [DRIVE_FOLDER_ID] });
    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}` +
      `\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([prefix, image, suffix]);
    const response = await driveRequest(accessToken, {
      path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, body);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(response.body.toString());
    }

    const file = JSON.parse(response.body.toString());
    console.log(`Foto "${name}" guardada en Google Drive`);
    json(res, 201, { name, url: `/api/photos/${file.id}` });
  } catch (error) {
    console.error('Error al subir a Google Drive:', error.message);
    json(res, error.statusCode || 502, {
      error: error.statusCode === 413 ? error.message : 'No se pudo guardar la foto en Google Drive',
    });
  }
}

async function serveDrivePhoto(res, fileId) {
  if (!DRIVE_ENABLED) return json(res, 503, { error: 'Google Drive no está configurado' });

  try {
    const accessToken = await getGoogleAccessToken();
    const request = https.request({
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return json(res, response.statusCode === 404 ? 404 : 502, { error: 'Foto no disponible en Google Drive' });
      }

      res.writeHead(200, {
        'Content-Type': response.headers['content-type'] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.on('error', () => res.destroy());
      response.pipe(res);
    });

    request.on('error', (error) => {
      console.error('Error al leer una foto de Google Drive:', error.message);
      if (!res.headersSent) json(res, 502, { error: 'No se pudo leer la foto de Google Drive' });
      else res.destroy();
    });
    request.end();
  } catch (error) {
    console.error('Error al autenticar con Google Drive:', error.message);
    json(res, 502, { error: 'No se pudo leer la foto de Google Drive' });
  }
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
  const photoMatch = pathname.match(/^\/api\/photos\/([A-Za-z0-9_-]+)$/);
  if (photoMatch) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
    return serveDrivePhoto(res, photoMatch[1]);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido' });

  const rel = pathname === '/' ? 'album-fotos.html' : pathname.slice(1);
  if (!PUBLIC_FILES.has(rel)) return json(res, 404, { error: 'No encontrado' });
  serve(res, PUBLIC, rel, false);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Portal listo en http://localhost:${PORT}`);
  if (!DRIVE_ENABLED) console.log('Google Drive no configurado; el álbum y las subidas requieren credenciales de Drive.');
});