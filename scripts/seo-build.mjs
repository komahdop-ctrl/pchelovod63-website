import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = process.argv[2] || 'dist'
const origin = 'https://pchelovod63.ru'
const escape = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const plain = s => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const urls = []
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) { await walk(file); continue }
    if (!entry.name.endsWith('.html')) continue
    const path = relative(root, file).replaceAll('\\', '/')
    // Other projects and personal greetings are outside the portal's SEO scope.
    if (/^(opylitel|russkaya-selitba|congratulations)\//.test(path)) continue
    let html = await readFile(file, 'utf8')
    if (/<meta\b[^>]*\bcontent=["'][^"']*\bnoindex\b/i.test(html)) continue
    const title = plain(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    if (!title) throw Error(`Missing title: ${path}`)
    const canonical = origin + '/' + (path === 'index.html' ? '' : path.startsWith('music/') ? path.replace(/index\.html$/, '') : path)
    // Normalize existing canonical values too; never canonicalize every article to home.
    html = html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
    let tags = `<link rel="canonical" href="${canonical}">`
    let description = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    if (!description) {
      description = path === 'index.html'
        ? 'Пчеловод 63 — неофициальный портал пчеловодов Самарской области: пасеки, практические статьи, новости, встречи и жизнь сообщества.'
        : path === 'privacy.html' ? 'Правила обращения в редакцию портала «Пчеловод 63», публикации материалов и обработки персональных данных.' : title
      tags += `<meta name="description" content="${escape(description)}">`
    }
    for (const [property, content] of Object.entries({ 'og:title': title, 'og:description': description, 'og:url': canonical, 'og:type': 'website', 'og:site_name': 'ПЧЕЛОВОД 63', 'og:locale': 'ru_RU' })) {
      if (!html.includes(`property="${property}"`) && !html.includes(`property='${property}'`)) tags += `<meta property="${property}" content="${escape(content)}">`
    }
    if (path === 'index.html' && !html.includes('application/ld+json')) {
      tags += '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'ПЧЕЛОВОД 63', url: origin + '/', inLanguage: 'ru-RU', description }) + '</script>'
    }
    if (path === 'news/index.html') {
      const items = JSON.parse(await readFile(join(root, 'news-data.json'), 'utf8'))
      const links = items.filter(n => !n.sensitive).map(n => {
        const url = new URL(n.url, canonical)
        if (url.origin !== origin || !url.pathname.startsWith('/news/')) throw Error('Unexpected news URL')
        return `<article class="card"><div class="card-body"><h3><a href="${escape(n.url)}">${escape(n.title)}</a></h3><p>${escape(n.summary)}</p></div></article>`
      }).join('')
      // Visible initial HTML; the existing script enhances it with filters and calendar.
      html = html.replace('<div id="news-grid" class="grid"><p>Загрузка…</p></div>', `<div id="news-grid" class="grid">${links}</div>`)
    }
    html = html.replace('</head>', tags + '</head>')
    await writeFile(file, html)
    urls.push(canonical)
  }
}
await walk(root)
await writeFile(join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.sort().map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n') + '\n</urlset>\n')
console.log(`SEO metadata and sitemap: ${urls.length} public pages`)
