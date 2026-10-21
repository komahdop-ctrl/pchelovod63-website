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
      if (ctx.path === '/index.html') {
        html = html.replace('<section class="community-why container"', '<section class="container" style="padding-top:26px;padding-bottom:26px"><a href="./news/iii-forum-pchelovodov-pfo-orenburg-2026.html" style="display:block;border:1px solid #d9bc79;border-radius:16px;padding:24px;background:linear-gradient(120deg,#fff2c9,#eef6e8);color:#513a19;text-decoration:none"><span style="font-size:12px;letter-spacing:2px">НОВОСТИ И АНОНСЫ · 21 ОКТЯБРЯ 2026</span><h2 style="font-family:Georgia,serif;margin:10px 0;font-size:28px">III Форум пчеловодов ПФО — 14–15 ноября, Оренбург</h2><p style="margin:0 0 12px">Программа, место проведения и статус проверки официального источника.</p><strong>Читать анонс →</strong></a></section><section class="community-why container"')
        html = html.replace('</nav>', '<a class="nav-link" href="./news/index.html">📰 Новости и анонсы</a></nav>')
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
      const depth = ctx.path.split('/').filter(Boolean).length - 1
      const relative = depth > 0 ? '../'.repeat(depth) : './'
      return {
        html,
        tags: [
          { tag: 'link', attrs: { rel: 'stylesheet', href: relative + 'chat-widget.css' }, injectTo: 'head' },
          { tag: 'script', attrs: { src: relative + 'chat-config.js', defer: true }, injectTo: 'body' },
          { tag: 'script', attrs: { src: relative + 'chat-widget.js', defer: true }, injectTo: 'body' },
        ],
      }
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
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
        ...articles,
      },
    },
  },
})
