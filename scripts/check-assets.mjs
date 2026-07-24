import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const assetsRoot = join(root, 'public', 'assets')
const manifestPath = join(root, 'ASSET_LICENSES.md')

if (!existsSync(manifestPath)) throw new Error('ASSET_LICENSES.md is required')
const manifest = readFileSync(manifestPath, 'utf8')

function files(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const unlisted = files(assetsRoot)
  .map((path) => relative(root, path))
  .filter((path) => !manifest.includes(`\`${path}\``))

if (unlisted.length) throw new Error(`Unlisted assets: ${unlisted.join(', ')}`)
console.log(`asset provenance ok (${files(assetsRoot).length} files)`)
