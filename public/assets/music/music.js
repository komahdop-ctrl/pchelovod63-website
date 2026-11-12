document.addEventListener('play', event => {
  if (!(event.target instanceof HTMLMediaElement)) return;
  document.querySelectorAll('audio,video').forEach(media => {
    if (media !== event.target) media.pause();
  });
}, true);
document.querySelector('[data-share]')?.addEventListener('click', async () => {
  const url = document.querySelector('link[rel="canonical"]').href;
  const status = document.querySelector('[data-share-status]');
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'Ссылка скопирована';
  } catch {
    const fallback = document.querySelector('[data-share-fallback]');
    fallback.hidden = false;
    fallback.value = url;
    fallback.focus();
    fallback.select();
    status.textContent = 'Скопируйте выделенную ссылку';
  }
});
document.querySelectorAll('audio').forEach(audio => audio.addEventListener('error', () => {
  audio.hidden = true;
  const message = document.createElement('p');
  message.textContent = 'Аудио сейчас недоступно.';
  audio.after(message);
}));
