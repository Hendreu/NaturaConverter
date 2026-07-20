import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { fileLoader } from '../src/platform/node'
import { FileReader, FileSaver } from '../src'

const testDir = import.meta.dirname
const worldFilesDir = join(testDir, 'WorldFiles')

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

function discoverWorldFiles(dir: string, minVersion?: number[]): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.wld'))
    .filter((f) => {
      if (!minVersion) return true
      const ver = parseVersion(f)
      return ver != null && versionAtLeast(ver, minVersion)
    })
    .sort()
    .map((f) => join(dir, f))
}

const allWorlds = [...discoverWorldFiles(testDir), ...discoverWorldFiles(worldFilesDir, [1, 3, 5, 3])]

describe.skipIf(allWorlds.length === 0)('File saver', () => {
  test.for(allWorlds.map((f) => [f.split(/[\\/]/).pop()!, f]))(
    '%s',
    { timeout: 60_000 },
    async ([_name, filePath]) => {
      const input = await fileLoader(filePath)
      const world = (await new FileReader().loadBuffer(input)).parse()
      const output = new FileSaver().save(world)

      expect(output.byteLength).toBe(input.byteLength)
      expect(Buffer.compare(Buffer.from(output), Buffer.from(input))).toBe(0)
    },
  )
})
