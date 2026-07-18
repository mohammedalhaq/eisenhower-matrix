import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distPath = resolve('dist')
const htmlPath = resolve(distPath, 'index.html')
const serverEntryPath = resolve('node_modules/.tmp/eisenhower-ssr/entry-server.js')

const template = await readFile(htmlPath, 'utf-8')
const { render } = await import(serverEntryPath)
const appHtml = render()

await writeFile(htmlPath, template.replace('<!--app-html-->', appHtml))
