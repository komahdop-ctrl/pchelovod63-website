import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const parts = [0, 1, 2].map((n) =>
  resolve(root, `assets/forum-cover/forum-orenburg-2026.part${n}.b64`)
)
const chunks = await Promise.all(parts.map((file) => readFile(file, 'utf8')))
const target = resolve(root, 'public/assets/news/forum-orenburg-2026.avif')
await mkdir(dirname(target), { recursive: true })
await writeFile(target, Buffer.from(chunks.join('').replace(/\s+/g, ''), 'base64'))
console.log('Generated', target)
