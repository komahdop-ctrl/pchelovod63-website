import { resolve } from 'node:path'

import { defineConfig } from 'vite'

// Publish only fully edited, reviewed articles. Other drafts remain in Git history/source,
// but are not included in the public GitHub Pages build.
const articles = {
  'article-autumn-syrup': resolve(import.meta.dirname, 'articles/osennyaya-podkormka-saharnym-siropom.html'),
  'article-zimovka-na-mede': resolve(import.meta.dirname, 'articles/zimovka-na-mede.html'),
  'article-kak-zaregistrirovat-paseku': resolve(import.meta.dirname, 'articles/kak-zaregistrirovat-paseku.html'),
}

export default defineConfig({
  // Общий виджет подключается к каждой HTML-странице при сборке.
  // Относительные пути работают и на собственном домене, и на GitHub Pages /repo/.
  plugins: [{
    name: 'p63-chat-widget',
    transformIndexHtml(html, ctx) {
      // No chat widget on Opylytel registration/privacy pages: these process personal data.
      if (ctx.path.startsWith('/opylitel/') || ctx.path.startsWith('/russkaya-selitba/')) return html
      if (ctx.path === '/index.html') {
        html = html.replace('<section class="community-why container"', '<section class="container" style="padding-top:26px;padding-bottom:26px"><a href="./news/iii-forum-pchelovodov-pfo-orenburg-2026.html" style="display:block;border:1px solid #d9bc79;border-radius:16px;padding:24px;background:linear-gradient(120deg,#fff2c9,#eef6e8);color:#513a19;text-decoration:none"><span style="font-size:12px;letter-spacing:2px">НОВОСТИ И АНОНСЫ · ОБНОВЛЕНО 23 ОКТЯБРЯ</span><h2 style="font-family:Georgia,serif;margin:10px 0;font-size:28px">III Форум пчеловодов ПФО — 14–15 ноября, Оренбург</h2><p style="margin:0 0 12px">Подробный гид: программа, дискуссия о потравах, конкурсы мёда и самоделок, условия участия.</p><strong>Читать анонс →</strong></a></section><section class="community-why container"')
        html = html.replace('</nav>', '<a class="nav-link" href="./news/index.html">📰 Новости и анонсы</a></nav>')
        // Opylytel beta: reuse the Pchelovod 63 community homepage without modifying its large source file.
        html = html.replace('</nav>', '<a class="nav-link" href="./opylitel/">🌻 ОПЫЛИТЕЛЬ · 2027</a></nav>')
        html = html.replace('<section class="community-why container"', '<section class="container" style="padding-top:26px;padding-bottom:26px"><a href="./opylitel/" style="display:block;text-decoration:none;background:linear-gradient(120deg,#eaf5dd,#f9efce);color:#1c462e;border:1px solid #cadbc3;border-radius:18px;padding:25px"><span style="font-size:12px;letter-spacing:2px;font-weight:700">НОВЫЙ ПРОЕКТ · ОПЫЛЕНИЕ 2027</span><h2 style="font-family:Georgia,serif;font-weight:500;font-size:29px;line-height:1.2;margin:10px 0">ОПЫЛИТЕЛЬ — объединяем поля и пасеки</h2><p style="margin:0 0 12px;line-height:1.6">В первой бета-версии уже есть анкета пчеловода. Пока доступен предварительный просмотр; сбор данных откроем после подключения защищённого хранения.</p><strong>Посмотреть проект →</strong></a></section><section class="community-why container"')
      }
      // Replace the duplicated "Beekeepers" nav item with the new FAQ section.
      if (ctx.path === '/index.html') html = html.replace(
        '<a class="nav-link" href="./apiaries/index.html">♟ Пчеловоды</a>',
        '<a class="nav-link" href="./faq/index.html">? Вопросы и ответы</a>'
      )
      // Update the older homepage article teaser during the build.
      // index.html is a large static document with embedded photographs.
      html = html.replace('href="./articles/sanpin-pchely-2026.html"', 'href="./articles/kak-zaregistrirovat-paseku.html"')
        .replace('Актуально: СанПиН и защита пчёл', 'Новое: как зарегистрировать пасеку')
      // The old Cloudflare chat widget is retired. All Pchelovod 63 pages
      // link directly to the existing MAX community chat without loading chat code.
      if (ctx.path !== '/index.html') {
        html = html.replace('</body>', `<a class="p63-max-chat-shortcut" href="https://max.ru/join/AyeqmcceXrj0-DUU6eYFV_1aW947vEiFZJuWvVIrmQ8" target="_blank" rel="noopener noreferrer" aria-label="Открыть чат «Пчеловод 63» в MAX" title="Чат «Пчеловод 63» в MAX">MAX <span aria-hidden="true">🐝</span></a><style>.p63-max-chat-shortcut{position:fixed;right:20px;bottom:20px;z-index:100;display:flex;align-items:center;justify-content:center;gap:5px;min-height:60px;min-width:60px;padding:8px;border-radius:50px;border:3px solid #fff;background:#ffc540;color:#253316;text-decoration:none;font:800 12px Arial,sans-serif;box-shadow:0 9px 30px #4a2c0750}.p63-max-chat-shortcut:hover{transform:scale(1.05)}@media(max-width:480px){.p63-max-chat-shortcut{right:13px;bottom:12px}}</style></body>`)
      }
      return html
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        opylitel: resolve(import.meta.dirname, 'opylitel/index.html'),
        'russkaya-selitba': resolve(import.meta.dirname, 'russkaya-selitba/index.html'),
        'opylitel-privacy': resolve(import.meta.dirname, 'opylitel/privacy.html'),
        'opylitel-consent': resolve(import.meta.dirname, 'opylitel/consent.html'),
        'opylitel-agrarian': resolve(import.meta.dirname, 'opylitel/agrarian.html'),
        congratulations: resolve(import.meta.dirname, 'congratulations/tatyana.html'),
        event: resolve(import.meta.dirname, 'events/druzhba-2026.html'),
        apiaries: resolve(import.meta.dirname, 'apiaries/index.html'),
        hutorok: resolve(import.meta.dirname, 'apiaries/hutorok.html'),
        organizations: resolve(import.meta.dirname, 'organizations/index.html'),
        articles: resolve(import.meta.dirname, 'articles/index.html'),
        faq: resolve(import.meta.dirname, 'faq/index.html'),
        'faq-white-honey': resolve(import.meta.dirname, 'faq/belye-pyatna-v-myode.html'),
        news: resolve(import.meta.dirname, 'news/index.html'),
        'news-forum-pfo-orenburg-2026': resolve(import.meta.dirname, 'news/iii-forum-pchelovodov-pfo-orenburg-2026.html'),
        'news-masterskaya-pchelovodstva-yug-krasnodar-2026': resolve(import.meta.dirname, 'news/masterskaya-pchelovodstva-yug-krasnodar-2026.html'),
        'news-samarskie-pchelovody-konkursy-orenburg-2026': resolve(import.meta.dirname, 'news/samarskie-pchelovody-konkursy-orenburg-2026.html'),
        'news-potravy-pchel-obsuzhdenie-orenburg-2026': resolve(import.meta.dirname, 'news/potravy-pchel-obsuzhdenie-orenburg-2026.html'),
        ...articles,
      },
    },
  },
})
