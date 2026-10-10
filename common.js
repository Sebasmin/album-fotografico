(() => {
  const C = window.EVENT;
  Object.entries(C.theme).forEach(([k, v]) => document.documentElement.style.setProperty(`--${k}`, v));
  document.querySelectorAll('[data-c]').forEach((el) => (el.textContent = C[el.dataset.c]));
  document.title = `${C.intro} ${C.name}`;
})();
