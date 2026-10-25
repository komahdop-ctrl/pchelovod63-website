/* ПЧЕЛОВОД 63: общие настройки комфортного чтения. Без сторонних библиотек и cookies. */
(function () {
  'use strict';

  var STORAGE_KEY = 'p63.reader.font-level.v1';
  var LEVELS = [1, 1.15, 1.3, 1.45, 1.6];
  var root = document.documentElement;
  var level = 0;

  try {
    var stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isInteger(stored) && stored >= 0 && stored < LEVELS.length) level = stored;
  } catch (_) {
    // Настройка работает и при запрете localStorage, но не сохраняется.
  }

  function applyScale() {
    var factor = LEVELS[level];
    root.style.setProperty('--p63-reading-factor', String(factor));
    root.style.setProperty('--p63-heading-factor', String(1 + (factor - 1) * 0.7));
    root.dataset.p63ReadingLevel = String(level);
  }

  // Устанавливаем сохранённое значение до появления элементов управления.
  applyScale();

  var path = window.location.pathname;
  var isReadingPage = /\/(?:articles|faq|news)\/(?!index\.html$)[^/]+\.html$/i.test(path);
  if (isReadingPage) root.dataset.p63ReadingPage = 'article';
  var isMobile = function () {
    return window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  };

  var TEXT_SELECTOR = [
    'main p', 'main li', 'main h1', 'main h2', 'main h3', 'main h4',
    'main blockquote', 'main td', 'main th', 'main dt', 'main dd',
    'main figcaption', 'main small', 'main summary',
    'main .read', 'main .button', 'main .card b', 'main .lead',
    'section p', 'section li', 'section h2', 'section h3', 'section h4',
    'section blockquote', 'section figcaption', 'section small',
    '.content p', '.content li', '.content h2', '.content h3',
    '.hero p', '.article-hero p', '.section-card h3',
    '.pager a', '.footer-call p'
  ].join(', ');

  function measureText() {
    var nodes = Array.from(document.querySelectorAll(TEXT_SELECTOR))
      .filter(function (node) {
        return !node.closest('.p63-reading-shortcut, .p63-reader-toolbar, pre, code, svg');
      });

    // Сначала убираем старый размер у ВСЕХ узлов, чтобы при смене ширины
    // не замерять дочерний текст внутри уже увеличенного родителя.
    nodes.forEach(function (node) {
      node.classList.remove('p63-readable-text');
    });

    var sizes = nodes.map(function (node) {
      var px = Number.parseFloat(window.getComputedStyle(node).fontSize);
      if (!Number.isFinite(px) || px <= 0) return null;
      var isBodyText = node.matches('p, li, blockquote, dt, dd');
      var isFootnote = node.closest('.toc, .source-list, .refs, .references, .footnotes, .source, .small, .hint, .meta, .eyebrow') ||
        node.matches('.small, .hint, .meta, .eyebrow');
      if (isMobile() && isBodyText && !isFootnote) {
        if (isReadingPage && node.closest('main, article, .content')) px = Math.max(18, px);
        else if (node.closest('main, section, .content')) px = Math.max(16, px);
      }
      if (isMobile() && node.matches('h3') && node.closest('.section-card')) {
        px = Math.max(16, px);
      }
      return px;
    });

    nodes.forEach(function (node, index) {
      if (sizes[index] === null) return;
      node.style.setProperty('--p63-original-size', sizes[index] + 'px');
      node.classList.add('p63-readable-text');
      if (node.matches('h1, h2, h3, h4')) node.classList.add('p63-readable-heading');
    });
  }

  function updateButtons() {
    var status = Math.round(LEVELS[level] * 100) + '%';
    document.querySelectorAll('[data-p63-size]').forEach(function (node) {
      node.textContent = status;
    });
    document.querySelectorAll('[data-p63-minus]').forEach(function (node) {
      node.disabled = level === 0;
    });
    document.querySelectorAll('[data-p63-plus]').forEach(function (node) {
      node.disabled = level === LEVELS.length - 1;
    });
    document.querySelectorAll('[data-p63-reset]').forEach(function (node) {
      node.disabled = level === 0;
    });
    document.querySelectorAll('[data-p63-toggle]').forEach(function (node) {
      var enlarged = level !== 0;
      node.setAttribute('aria-pressed', String(enlarged));
      node.setAttribute('aria-label', enlarged ? 'Вернуть обычный размер текста' : 'Увеличить размер текста');
      var caption = node.querySelector('[data-p63-toggle-label]');
      if (caption) caption.textContent = enlarged ? 'Обычный шрифт' : 'Крупный шрифт';
    });
  }

  function setLevel(newLevel) {
    var next = Math.max(0, Math.min(LEVELS.length - 1, newLevel));
    if (next === level) return;
    level = next;
    applyScale();
    try {
      window.localStorage.setItem(STORAGE_KEY, String(level));
    } catch (_) {
      // Для чтения localStorage не обязателен.
    }
    updateButtons();
  }

  function createGlobalControl() {
    var control = document.createElement('div');
    control.className = 'p63-reading-shortcut';
    control.setAttribute('role', 'region');
    control.setAttribute('aria-label', 'Настройки размера текста');
    control.innerHTML =
      '<div class="p63-reading-shortcut-inner">' +
        '<span class="p63-reading-shortcut-hint">Удобное чтение</span>' +
        '<button type="button" class="p63-reading-toggle" data-p63-toggle aria-pressed="false">' +
          '<span class="p63-reading-aa" aria-hidden="true">Аа</span>' +
          '<span data-p63-toggle-label>Крупный шрифт</span>' +
        '</button>' +
      '</div>';

    var header = document.querySelector('body > header') || document.querySelector('header');
    if (header) header.insertAdjacentElement('afterend', control);
    else document.body.insertBefore(control, document.body.firstChild);

    control.querySelector('[data-p63-toggle]').addEventListener('click', function () {
      setLevel(level === 0 ? 2 : 0);
    });
  }

  function createArticleControls() {
    if (!isReadingPage) return;
    var main = document.querySelector('main') ||
      document.querySelector('article') || document.querySelector('.content');
    if (!main) return;

    var control = document.createElement('div');
    control.className = 'p63-reader-toolbar';
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Размер текста статьи');
    control.innerHTML =
      '<span class="p63-reader-title">Размер текста</span>' +
      '<div class="p63-reader-actions">' +
        '<button type="button" data-p63-minus aria-label="Уменьшить текст" title="Уменьшить текст">А−</button>' +
        '<output class="p63-reader-value" data-p63-size aria-live="polite" aria-atomic="true">100%</output>' +
        '<button type="button" data-p63-plus aria-label="Увеличить текст" title="Увеличить текст">А+</button>' +
        '<button type="button" data-p63-reset class="p63-reader-reset" aria-label="Вернуть обычный размер" title="Вернуть обычный размер">↺</button>' +
      '</div>';
    main.insertBefore(control, main.firstChild);

    control.querySelector('[data-p63-minus]').addEventListener('click', function () {
      setLevel(level - 1);
    });
    control.querySelector('[data-p63-plus]').addEventListener('click', function () {
      setLevel(level + 1);
    });
    control.querySelector('[data-p63-reset]').addEventListener('click', function () {
      setLevel(0);
    });
  }

  function init() {
    createGlobalControl();
    createArticleControls();
    measureText();
    updateButtons();

    // Заголовки с clamp(...) и мобильные базовые размеры пересчитываем при повороте.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measureText, 150);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
