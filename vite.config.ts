import { resolve } from 'node:path'
import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'

const articles = Object.fromEntries(
  readdirSync(resolve(import.meta.dirname, 'articles'))
    .filter(name => name.endsWith('.html') && name !== 'index.html')
    .map(name => ['article-' + name.replace(/\.html$/, ''), resolve(import.meta.dirname, 'articles', name)]),
)

export default defineConfig({
  // Общий виджет подключается к каждой HTML-странице при сборке.
  // Относительные пути работают и на собственном домене, и на GitHub Pages /repo/.
  plugins: [{
    name: 'p63-chat-widget',
    transformIndexHtml(html, ctx) {
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
