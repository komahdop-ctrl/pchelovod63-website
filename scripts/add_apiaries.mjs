import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const indexPath = path.join(root, 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')

const apiaryCard = /(<a href=")#coming(" class="section-card"[^>]*background-image:[^>]+><div class="section-card-caption"><span[^>]*>⌂<\/span><h3>Пасеки региона<\/h3><span class="mini-tag )(")>Скоро(<\/span>)/
if (!apiaryCard.test(html) && !html.includes('href="./apiaries/" class="section-card"')) {
  throw new Error('Не найдена карточка «Пасеки региона»')
}
html = html.replace(apiaryCard, '$1./apiaries/$2active$3>1 пасека$4')
html = html.replace('class="mini-tag active"">1 пасека', 'class="mini-tag active">1 пасека')
html = html.replace('<a class="nav-link" href="#coming">⌂ Пасеки</a>', '<a class="nav-link" href="./apiaries/">⌂ Пасеки</a>')
html = html.replace('<a href="#coming">Пасеки</a>', '<a href="./apiaries/">Пасеки</a>')
fs.writeFileSync(indexPath, html)

const titleAt = html.indexOf('<h3>Пасеки региона</h3>')
const anchorAt = html.lastIndexOf('<a ', titleAt)
const anchor = html.slice(anchorAt, titleAt)
const match = anchor.match(/url\('(data:image\/jpeg;base64,[^']+)'\)/)
if (!match) throw new Error('Не найдено изображение карточки пасек')
const outputDir = path.join(root, 'public', 'assets', 'apiaries')
fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'region-apiary.jpg'), Buffer.from(match[1].split(',')[1], 'base64'))
console.log('Раздел пасек подключён, исходное изображение карточки извлечено.')
