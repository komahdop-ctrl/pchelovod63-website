(() => {
  'use strict';

  if (document.getElementById('p63-chat-root')) return;
  const endpoint = String(window.P63_CHAT_WS_URL || '').trim();
  const root = document.createElement('div');
  root.id = 'p63-chat-root';
  root.innerHTML = `
    <section class="p63-panel" id="p63-chat-panel" aria-label="Улей общения" hidden>
      <div class="p63-head">
        <div><div class="p63-headline">🐝 Улей общения</div><div class="p63-state" role="status">Чат пока не подключён</div></div>
        <button type="button" class="p63-x" aria-label="Закрыть чат">×</button>
      </div>
      <div class="p63-online">Подключение к чату ожидается</div>
      <div class="p63-feed" role="log" aria-label="Сообщения чата" aria-live="polite"><div class="p63-note">Здесь можно будет общаться с пчеловодами Самарской области.</div></div>
      <form class="p63-bottom">
        <label class="p63-name-label">Ваше имя <input class="p63-name" maxlength="30" autocomplete="nickname" placeholder="Например, Виталий" /></label>
        <div class="p63-sendline"><input class="p63-message-input" maxlength="500" placeholder="Написать сообщение…" aria-label="Текст сообщения" required disabled /><button class="p63-send" type="submit" disabled>➤</button></div>
        <p class="p63-hint">Без регистрации · соблюдайте уважительный тон</p>
      </form>
    </section>
    <button type="button" class="p63-trigger" aria-controls="p63-chat-panel" aria-expanded="false"><span>🐝 Улей общения</span><span class="p63-count" hidden></span></button>`;
  document.body.append(root);

  const panel = root.querySelector('.p63-panel');
  const trigger = root.querySelector('.p63-trigger');
  const closeButton = root.querySelector('.p63-x');
  const stateEl = root.querySelector('.p63-state');
  const onlineEl = root.querySelector('.p63-online');
  const feed = root.querySelector('.p63-feed');
  const form = root.querySelector('.p63-bottom');
  const nameEl = root.querySelector('.p63-name');
  const messageEl = root.querySelector('.p63-message-input');
  const sendButton = root.querySelector('.p63-send');
  const hintEl = root.querySelector('.p63-hint');
  const countEl = root.querySelector('.p63-count');
  const formatTime = new Intl.DateTimeFormat('ru-RU', { hour:'2-digit', minute:'2-digit' });

  function saved(key, fallback = '') { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch { /* private browsing */ } }
  function randomId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(); }
  const visitorId = saved('p63-chat-visitor') || randomId();
  store('p63-chat-visitor', visitorId);
  nameEl.value = saved('p63-chat-name').slice(0,30);
  let socket = null, ownSocketId = null, retryTimer = null, retryDelay = 1500;
  let opened = false, connected = false, messageIds = new Set();

  function status(text, enabled) {
    stateEl.textContent = text;
    connected = enabled;
    messageEl.disabled = !enabled;
    sendButton.disabled = !enabled;
    if (!enabled) { countEl.hidden = true; onlineEl.textContent = 'Участники онлайн: нет подключения'; }
  }
  function showNote(text) {
    feed.replaceChildren();
    const note = document.createElement('div');
    note.className = 'p63-note'; note.textContent = text;
    feed.append(note);
  }
  function setOpen(value) {
    opened = value;
    panel.hidden = !value;
    trigger.setAttribute('aria-expanded', String(value));
    if (value) {
      if (connected) messageEl.focus();
      else nameEl.focus();
    } else trigger.focus();
  }
  trigger.addEventListener('click', () => setOpen(!opened));
  closeButton.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && opened) setOpen(false);
  });

  function renderMessage(message) {
    if (!message || typeof message.id !== 'string' || messageIds.has(message.id)) return;
    if (typeof message.text !== 'string') return;
    messageIds.add(message.id);
    const note = feed.querySelector('.p63-note');
    if (note) note.remove();
    const item = document.createElement('article');
    item.className = 'p63-msg' + (message.senderId === ownSocketId ? ' p63-mine' : '');
    item.dataset.id = message.id;
    const author = document.createElement('div'); author.className = 'p63-author';
    const name = document.createElement('span'); name.textContent = String(message.name || 'Гость');
    const time = document.createElement('span'); time.className = 'p63-time';
    const stamp = Number(message.createdAt);
    time.textContent = Number.isFinite(stamp) ? formatTime.format(new Date(stamp)) : '';
    const body = document.createElement('p'); body.className = 'p63-text'; body.textContent = message.text;
    author.append(name, time); item.append(author, body); feed.append(item);
    while (feed.querySelectorAll('.p63-msg').length > 100) feed.querySelector('.p63-msg').remove();
    feed.scrollTop = feed.scrollHeight;
  }

  function send(data) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
  }
  function join() {
    const name = nameEl.value.trim().slice(0,30);
    store('p63-chat-name', name);
    send({ type:'join', visitorId, name, active: !document.hidden });
  }
  nameEl.addEventListener('change', join);
  nameEl.addEventListener('blur', join);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!connected) return;
    const text = messageEl.value.trim();
    if (!text) return;
    if (text.length > 500) { hintEl.textContent = 'Сообщение слишком длинное'; return; }
    join();
    send({type:'message', text});
    messageEl.value = '';
    hintEl.textContent = 'Без регистрации · соблюдайте уважительный тон';
  });

  function handlePacket(packet) {
    if (!packet || typeof packet.type !== 'string') return;
    if (packet.type === 'hello') {
      ownSocketId = packet.socketId || null;
      messageIds = new Set();
      feed.replaceChildren();
      const messages = Array.isArray(packet.messages) ? packet.messages : [];
      messages.forEach(renderMessage);
      if (!messages.length) showNote('Пока нет сообщений. Начните знакомство!');
    } else if (packet.type === 'message') {
      renderMessage(packet.message);
    } else if (packet.type === 'presence') {
      const n = Number(packet.count) || 0;
      countEl.textContent = String(n);
      countEl.hidden = false;
      const names = Array.isArray(packet.names) ? packet.names.filter(x => typeof x === 'string') : [];
      onlineEl.textContent = 'Сейчас на сайте: ' + n + (names.length ? ' · ' + names.slice(0,8).join(', ') + (names.length>8?'…':'') : ' · гости');
    } else if (packet.type === 'delete' && typeof packet.id === 'string') {
      const node = Array.from(feed.querySelectorAll('.p63-msg')).find(el => el.dataset.id === packet.id);
      if (node) node.remove();
      messageIds.delete(packet.id);
      if (!feed.querySelector('.p63-msg')) showNote('Пока нет сообщений. Начните знакомство!');
    } else if (packet.type === 'error') {
      hintEl.textContent = String(packet.message || 'Не удалось отправить сообщение').slice(0,120);
    }
  }

  function connect() {
    if (!endpoint || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const valid = /^wss:\/\/[^\s]+\/chat(?:\?.*)?$/.test(endpoint)
      || (location.hostname === 'localhost' && /^ws:\/\/[^\s]+\/chat$/.test(endpoint));
    if (!valid) { status('Неверно настроен адрес сервера', false); return; }
    status('Подключаемся…', false);
    try { socket = new WebSocket(endpoint); }
    catch { status('Сервер недоступен', false); return; }
    const current = socket;
    current.addEventListener('open', () => {
      if (socket !== current) return;
      retryDelay = 1500;
      status('В сети · общение открыто', true);
      join();
    });
    current.addEventListener('message', (event) => {
      try { handlePacket(JSON.parse(event.data)); } catch { /* ignore invalid payload */ }
    });
    current.addEventListener('close', () => {
      if (socket !== current) return;
      status('Связь потеряна · переподключаемся', false);
      socket = null;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    });
    current.addEventListener('error', () => { status('Ошибка соединения', false); });
  }

  document.addEventListener('visibilitychange', () => send({type:'presence', active:!document.hidden}));
  window.addEventListener('pagehide', () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (socket) socket.close(1000, 'page closed');
  });
  // Cloudflare Durable Object может ответить на такой heartbeat без пробуждения.
  setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping'); }, 30000);
  if (endpoint) connect();
  else {
    status('Скоро откроем · сервер не подключён', false);
    showNote('Мини-чат уже добавлен на сайт. Для начала живого общения осталось подключить сервер.');
  }
})();
