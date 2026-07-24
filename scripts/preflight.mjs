import { execFileSync } from 'node:child_process'

const EXPECTED_NODE = 'v24.18.0'
const EXPECTED_NPM = '11.8.0'

function read(command, args = []) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

const npmVersion = read('npm', ['--version'])
if (process.version !== EXPECTED_NODE) {
  throw new Error(`Node ${EXPECTED_NODE} required; received ${process.version}`)
}
if (npmVersion !== EXPECTED_NPM) {
  throw new Error(`npm ${EXPECTED_NPM} required; received ${npmVersion}`)
}

let chromeVersion
try {
  chromeVersion = read('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--version'])
} catch {
  chromeVersion = 'not-installed'
}

console.log(JSON.stringify({ node: process.version, npm: npmVersion, systemChrome: chromeVersion }))
