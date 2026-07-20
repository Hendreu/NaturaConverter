import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileLoader } from '../src/platform/node'
import { FileReader, FileSaver } from '../src'

const worldFilesDir = join(import.meta.dirname, 'WorldFiles')

function parseVersion(filename: string): number[] | null {
  const match = filename.match(/^v(\d+(?:\.\d+)*)/)
  if (!match) return null
  return match[1].split('.').map(Number)
}

function versionAtLeast(ver: number[], min: number[]): boolean {
  for (let i = 0; i < min.length; i++) {
    const v = ver[i] ?? 0
    if (v > min[i]) return true
    if (v < min[i]) return false
  }
  return true
}

if (!existsSync(worldFilesDir)) {
  console.log('No WorldFiles directory found, skipping.')
  process.exit(0)
}

const supportedWorldFiles = readdirSync(worldFilesDir)
  .filter((f) => f.endsWith('.wld'))
  .filter((f) => {
    const ver = parseVersion(f)
    if (!ver) return false
    return versionAtLeast(ver, [1, 3, 5, 3])
  })
  .sort()

async function bytePerfectRoundTrip(filePath: string): Promise<string | null> {
  const inputBuffer = await fileLoader(filePath)
  const world = (await new FileReader().loadBuffer(inputBuffer)).parse()
  const outputBuffer = new FileSaver().save(world)

  if (outputBuffer.byteLength !== inputBuffer.byteLength) {
    return `Size mismatch: expected ${inputBuffer.byteLength}, got ${outputBuffer.byteLength}`
  }

  const inputView = new Uint8Array(inputBuffer)
  const outputView = new Uint8Array(outputBuffer)
  for (let i = 0; i < inputView.length; i++) {
    if (inputView[i] !== outputView[i]) {
      return `Byte mismatch at offset ${i} (0x${i.toString(16)}): expected 0x${inputView[i].toString(16).padStart(2, '0')}, got 0x${outputView[i].toString(16).padStart(2, '0')}`
    }
  }
  return null
}

async function main() {
  console.log(`Testing ${supportedWorldFiles.length} supported world files...\n`)
  const failures: string[] = []

  for (const fileName of supportedWorldFiles) {
    const start = performance.now()
    try {
      const error = await bytePerfectRoundTrip(join(worldFilesDir, fileName))
      const elapsed = (performance.now() - start).toFixed(0)
      if (error) {
        console.log(`  FAIL: ${fileName} (${elapsed}ms) - ${error}`)
        failures.push(fileName)
      } else {
        console.log(`  PASS: ${fileName} (${elapsed}ms)`)
      }
    } catch (e) {
      const elapsed = (performance.now() - start).toFixed(0)
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ERROR: ${fileName} (${elapsed}ms) - ${msg}`)
      failures.push(fileName)
    }
  }

  console.log(`\n${supportedWorldFiles.length - failures.length}/${supportedWorldFiles.length} passed`)
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(', ')}`)
    process.exit(1)
  }
}

main()
