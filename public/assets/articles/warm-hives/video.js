for (const slot of document.querySelectorAll('.video-slot[data-video]')) {
  slot.querySelector('button')?.addEventListener('click', () => {
    const id = slot.dataset.video;
    if (!/^[a-f0-9]{32}$/.test(id)) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://rutube.ru/play/embed/${id}/`;
    iframe.title = slot.dataset.title || 'Видео RUTUBE';
    iframe.allow = 'fullscreen; picture-in-picture; encrypted-media';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'no-referrer';
    slot.replaceChildren(iframe);
    iframe.focus();
  }, { once: true });
}
