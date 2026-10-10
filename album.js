(() => {
  const C = window.EVENT, $ = (id) => document.getElementById(id);
  const PER_PAGE = 4;
  const book = $('book'), viewer = $('viewer');
  let photos = [], cur = 0;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  function coverSheet() {
    const s = el('article', 'sheet cover');
    s.append(el('div', 'symbol', C.symbol), el('p', 'intro', C.intro), el('h1', '', C.name), el('p', 'sub', C.albumTitle), el('p', 'date', C.date));
    return s;
  }

  function emptySheet() {
    const s = el('article', 'sheet paper');
    const a = el('a', 'link', 'Subir fotos');
    a.href = 'album-fotos.html';
    s.append(el('p', 'empty', C.emptyText), a);
    return s;
  }

  function paperSheet(chunk, n, offset) {
    const s = el('article', 'sheet paper'), grid = el('div', 'grid');
    const wide = [0, 2, -1][n % 3]; // 3 distribuciones que se alternan página a página
    chunk.forEach((p, j) => {
      const fig = el('figure', 'print');
      fig.style.setProperty('--r', `${((((offset + j) * 37) % 7) - 3) * 0.5}deg`);
      const img = new Image();
      img.src = p.url; img.loading = 'lazy'; img.alt = 'Foto del evento';
      fig.append(img);
      fig.addEventListener('click', () => openViewer(offset + j));
      grid.append(fig);
    });
    s.append(grid, el('span', 'num', String(n + 1)));
    return s;
  }

  function build() {
    const sheets = [coverSheet()];
    if (!photos.length) sheets.push(emptySheet());
    for (let i = 0, n = 0; i < photos.length; i += PER_PAGE, n++) sheets.push(paperSheet(photos.slice(i, i + PER_PAGE), n, i));
    book.replaceChildren(...sheets);
    // $('count').textContent = `${photos.length} fotos`;
    el('div', 'photo-count', `${photos.length} fotos`)
    mark();
  }

  function mark() {
    const total = book.children.length, w = book.firstElementChild.clientWidth || 1;
    $('pos').textContent = `${Math.min(Math.round(book.scrollLeft / w) + 1, total)} / ${total}`;
  }

  async function load() {
    try {
      const data = await (await fetch('/api/photos')).json();
      if (JSON.stringify(data) === JSON.stringify(photos)) return;
      const x = book.scrollLeft;
      photos = data; build(); book.scrollLeft = x;
    } catch { /* se reintenta en el siguiente ciclo */ }
  }

  // Paginación (en pantallas grandes avanza de dos en dos hojas)
  $('prev').addEventListener('click', () => book.scrollBy({ left: -book.clientWidth, behavior: 'smooth' }));
  $('next').addEventListener('click', () => book.scrollBy({ left: book.clientWidth, behavior: 'smooth' }));
  book.addEventListener('scroll', mark, { passive: true });

  // Visor a pantalla completa
  const show = () => ($('viewerImg').src = photos[cur].url);
  const openViewer = (i) => { cur = i; show(); viewer.hidden = false; };
  const step = (d) => { cur = (cur + d + photos.length) % photos.length; show(); };
  viewer.addEventListener('click', () => (viewer.hidden = true));
  $('vPrev').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  $('vNext').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  document.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') viewer.hidden = true;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  build();
  load();
  setInterval(load, 20000); // el álbum se actualiza solo
})();
