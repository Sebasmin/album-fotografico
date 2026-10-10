(() => {
  const C = window.EVENT, $ = (id) => document.getElementById(id);
  const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX = 25 * 1024 * 1024;
  const btn = $('uploadBtn'), bar = $('progress'), status = $('status'), recent = $('recent');
  btn.textContent = C.uploadLabel;

  // Formatos no compatibles (p. ej. HEIC del iPhone) se convierten a JPG si el navegador los puede abrir
  async function prepare(file) {
    if (OK.includes(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const cv = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      cv.getContext('2d').drawImage(bmp, 0, 0);
      return await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
    } catch { return null; }
  }

  // Cada foto viaja como cuerpo de la petición (sin multipart) y así se ve el progreso real
  function send(blob, onProgress) {
    return new Promise((ok, fail) => {
      const x = new XMLHttpRequest();
      x.open('POST', '/api/photos');
      x.setRequestHeader('Content-Type', blob.type);
      x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
      x.onload = () => (x.status === 201 ? ok() : fail());
      x.onerror = fail;
      x.send(blob);
    });
  }

  function thumb(blob) {
    const img = new Image();
    img.src = URL.createObjectURL(blob); img.alt = 'Foto subida';
    recent.prepend(img);
  }

  btn.addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;

    btn.disabled = true; bar.hidden = false; bar.value = 0;
    const total = files.reduce((s, f) => s + f.size, 0);
    let sent = 0, done = 0, failed = 0;

    for (const [i, f] of files.entries()) {
      status.textContent = `Subiendo ${i + 1} de ${files.length}…`;
      const blob = await prepare(f);
      if (blob && blob.size <= MAX) {
        try { await send(blob, (l) => (bar.value = Math.min(1, (sent + l) / total))); done++; thumb(blob); }
        catch { failed++; }
      } else failed++;
      sent += f.size; bar.value = Math.min(1, sent / total);
    }

    bar.hidden = true; btn.disabled = false;
    status.textContent = done
      ? `¡Gracias! ${done} ${done === 1 ? 'foto ya está' : 'fotos ya están'} en el álbum.` + (failed ? ` ${failed} no se pudo subir.` : '')
      : 'No se pudieron subir las fotos. Revisa tu conexión e inténtalo de nuevo.';
  });
})();
