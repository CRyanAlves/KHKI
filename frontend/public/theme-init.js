(() => {
  let saved;
  try {
    saved = localStorage.getItem('khki-theme');
  } catch {}
  const theme = saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
})();
