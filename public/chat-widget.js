(() => {
  'use strict';
  if (document.getElementById('p63-chat-root')) return;
  const endpoint = String(window.P63_CHAT_API_URL || '').trim();
  const root = document.createElement('div');
  root.id = 'p63-chat-root';
  root.innerHTML = `<section class="p63-panel" id="p63-chat-panel" aria-label="Улей общения" hidden>
    <div class="p63-head"><div><div class="p63-headline">🐝 Улей общения</div><div class="p63-state" role="status">Подключаемся…</div></div><button type="button" class="p63-x" aria-label="Закрыть чат">×</button></div>
    <div class="p63-online">Общий чат посетителей портала</div>
    <div class="p63-feed" role="log" aria-label="Сообщения чата" aria-live="polite"><div class="p63-note">Загружаем сообщения…</div></div>
    <form class="p63-bottom"><label class="p63-name-label">Ваше имя <input class="p63-name" maxlength="32" autocomplete="nickname" placeholder="Например, Виталий" required /></label><div class="p63-sendline"><input class="p63-message-input" maxlength="300" placeholder="Написать сообщение…" aria-label="Текст сообщения" required /><button class="p63-send" type="submit">➤</button></div><p class="p63-hint">Без регистрации · соблюдайте уважительный тон</p></form>
  </section><button type="button" class="p63-trigger" aria-controls="p63-chat-panel" aria-expanded="false"><span>🐝 Улей общения</span></button>`;
  document.body.append(root);

  const panel = root.querySelector('.p63-panel');
  const trigger = root.querySelector('.p63-trigger');
  const closeButton = root.querySelector('.p63-x');
  const stateEl = root.querySelector('.p63-state');
  const feed = root.querySelector('.p63-feed');
  const form = root.querySelector('.p63-bottom');
  const nameEl = root.querySelector('.p63-name');
  const messageEl = root.querySelector('.p63-message-input');
  const sendButton = root.querySelector('.p63-send');
  const hintEl = root.querySelector('.p63-hint');
  const formatTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  let timer = null;

  try { nameEl.value = (localStorage.getItem('p63-chat-name') || '').slice(0, 32); } catch { /* private mode */ }
  const note = (text, error = false) => {
    feed.replaceChildren();
    const node = document.createElement('div');
    node.className = error ? 'p63-note p63-error' : 'p63-note';
    node.textContent = text;
    feed.append(node);
  };
  const render = (messages) => {
    feed.replaceChildren();
    if (!messages.length) return note('Пока нет сообщений. Начните знакомство!');
    messages.forEach((message) => {
      const item = document.createElement('article'); item.className = 'p63-msg';
      const author = document.createElement('div'); author.className = 'p63-author';
      const name = document.createElement('span'); name.textContent = String(message.name || 'Гость');
      const time = document.createElement('span'); time.className = 'p63-time';
      time.textContent = formatTime.format(new Date(message.createdAt));
      const body = document.createElement('p'); body.className = 'p63-text'; body.textContent = message.text;
      author.append(name, time); item.append(author, body); feed.append(item);
    });
    feed.scrollTop = feed.scrollHeight;
  };
  const load = async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      render(Array.isArray(data.messages) ? data.messages : []);
      stateEl.textContent = 'В сети · общение открыто';
    } catch {
      stateEl.textContent = 'Нет связи с сервером';
      note('Не удалось загрузить сообщения. Повторим попытку автоматически.', true);
    }
  };
  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    clearInterval(timer);
    if (open) { load(); timer = setInterval(load, 5000); (nameEl.value ? messageEl : nameEl).focus(); }
    else trigger.focus();
  };
  trigger.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameEl.value.trim().slice(0, 32);
    const text = messageEl.value.trim().slice(0, 300);
    if (!name) { hintEl.textContent = 'Сначала укажите ваше имя'; nameEl.focus(); return; }
    if (!text) return;
    try { localStorage.setItem('p63-chat-name', name); } catch { /* private mode */ }
    messageEl.disabled = true; sendButton.disabled = true; hintEl.textContent = 'Отправляем…';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить сообщение');
      messageEl.value = ''; hintEl.textContent = 'Без регистрации · соблюдайте уважительный тон'; await load();
    } catch (error) { hintEl.textContent = error.message || 'Не удалось отправить сообщение'; }
    finally { messageEl.disabled = false; sendButton.disabled = false; messageEl.focus(); }
  });
  if (!endpoint) { stateEl.textContent = 'Сервер не настроен'; note('Мини-чат временно недоступен.', true); }
})();
