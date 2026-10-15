import { resolve } from 'node:path'

import { defineConfig } from 'vite'

// Publish only fully edited, reviewed articles. Other drafts remain in Git history/source,
// but are not included in the public GitHub Pages build.
const articles = {
  'article-kak-zaregistrirovat-paseku': resolve(import.meta.dirname, 'articles/kak-zaregistrirovat-paseku.html'),
}

export default defineConfig({
  // Общий виджет подключается к каждой HTML-странице при сборке.
  // Относительные пути работают и на собственном домене, и на GitHub Pages /repo/.
  plugins: [{
    name: 'p63-chat-widget',
    transformIndexHtml(html, ctx) {
      if (ctx.path === '/index.html') html = html.replace('<section class="community-why container"', '<section class="container" style="padding-top:26px;padding-bottom:26px"><a href="./congratulations/tatyana.html" style="display:block;border:1px solid #d9bc79;border-radius:16px;padding:24px;background:linear-gradient(120deg,#fff2c9,#fffaf1);color:#513a19;text-decoration:none"><span style="font-size:12px;letter-spacing:2px">15 ОКТЯБРЯ · ПОЗДРАВЛЯЕМ</span><h2 style="font-family:Georgia,serif;margin:10px 0;font-size:28px">Татьяна Николаевна, с днём рождения!</h2><p style="margin:0 0 12px">Тёплые пожелания и песня в подарок от друзей-пчеловодов.</p><strong>Открыть поздравление и послушать песню →</strong></a></section><section class="community-why container"')
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
        ...articles,
      },
    },
  },
})
