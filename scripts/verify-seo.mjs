import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const root = process.argv[2] || 'dist'
const sitemap = await readFile(`${root}/sitemap.xml`, 'utf8')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
assert(urls.length >= 15, 'Unexpectedly few public pages')
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs')
const titles = new Set()
for (const url of urls) {
  assert(url.startsWith('https://pchelovod63.ru/'))
  assert(!/\/(opylitel|russkaya-selitba|congratulations)\//.test(url))
  const pathname = new URL(url).pathname.slice(1)
  const path = !pathname || pathname.endsWith('/') ? pathname + 'index.html' : pathname
  const html = await readFile(`${root}/${path}`, 'utf8')
  assert(!/<meta\b[^>]*\bcontent=["'][^"']*\bnoindex\b/i.test(html), path + ': noindex in sitemap')
  assert.equal((html.match(/rel=["']canonical["']/g) || []).length, 1, path)
  assert(html.includes(`rel="canonical" href="${url}"`), path)
  assert(/name=["']description["']/.test(html), path)
  assert(html.includes('og:title') && html.includes('og:url'), path)
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, path)
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1]
  assert(title && !titles.has(title), path + ': missing/duplicate title'); titles.add(title)
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(m[1])
}
const news = await readFile(`${root}/news/index.html`, 'utf8')
assert(news.includes('href="./iii-forum-pchelovodov-pfo-orenburg-2026.html"'), 'News needs static links')
assert(!urls.some(url => url.endsWith('/poezdka-orenburg-2026.html')), 'Noindex redirect in sitemap')
const robots = await readFile(`${root}/robots.txt`, 'utf8')
assert(robots.includes('Sitemap: https://pchelovod63.ru/sitemap.xml'))
console.log(`SEO verification passed: ${urls.length} pages; canonical, title, description, H1, OG, JSON-LD, static news, exclusions, robots`)
