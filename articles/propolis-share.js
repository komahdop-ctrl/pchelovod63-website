const button = document.getElementById('copy-article');
button?.addEventListener('click', async () => {
  const url = 'https://pchelovod63.ru/articles/kak-ochistit-propolis.html';
  const status = document.getElementById('copy-status');
  try { await navigator.clipboard.writeText(url); status.textContent = 'Ссылка скопирована.'; }
  catch { status.textContent = 'Не удалось скопировать автоматически. Удерживайте прямую ссылку ниже, чтобы скопировать её.'; }
});
