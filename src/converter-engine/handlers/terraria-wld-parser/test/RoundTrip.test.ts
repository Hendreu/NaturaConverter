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

// WorldFiles contains versioned files; filter to supported versions (>= 1.3.5.3)
const rootWorlds = discoverWorldFiles(testDir)
const subDirWorlds = discoverWorldFiles(worldFilesDir, [1, 3, 5, 3])
const allWorlds = [...rootWorlds, ...subDirWorlds]

async function bytePerfectRoundTrip(filePath: string) {
  const inputBuffer = await fileLoader(filePath)
  const world = (await new FileReader().loadBuffer(inputBuffer)).parse()
  const outputBuffer = new FileSaver().save(world)

  expect(outputBuffer.byteLength).toBe(inputBuffer.byteLength)

  const inputView = new Uint8Array(inputBuffer)
  const outputView = new Uint8Array(outputBuffer)
  let firstDiff = -1
  for (let i = 0; i < inputView.length; i++) {
    if (inputView[i] !== outputView[i]) {
      firstDiff = i
      break
    }
  }

  if (firstDiff !== -1) {
    const context = 16
    const start = Math.max(0, firstDiff - context)
    const end = Math.min(inputView.length, firstDiff + context)
    expect.fail(
      `Byte mismatch at offset ${firstDiff} (0x${firstDiff.toString(16)}): ` +
        `expected 0x${inputView[firstDiff].toString(16).padStart(2, '0')}, ` +
        `got 0x${outputView[firstDiff].toString(16).padStart(2, '0')}\n` +
        `Input  [${start}..${end}]: ${Array.from(inputView.slice(start, end)).map((b) => b.toString(16).padStart(2, '0')).join(' ')}\n` +
        `Output [${start}..${end}]: ${Array.from(outputView.slice(start, end)).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
    )
  }
}

async function dataEqualRoundTrip(filePath: string) {
  const inputBuffer = await fileLoader(filePath)
  const original = (await new FileReader().loadBuffer(inputBuffer)).parse()
  const savedBuffer = new FileSaver().save(original)
  const reloaded = (await new FileReader().loadBuffer(savedBuffer)).parse()

  // fileFormatHeader
  expect(reloaded.fileFormatHeader.version).toBe(original.fileFormatHeader.version)
  expect(reloaded.fileFormatHeader.magicNumber).toBe(original.fileFormatHeader.magicNumber)

  // header
  expect(reloaded.header.mapName).toBe(original.header.mapName)
  expect(reloaded.header.worldId).toBe(original.header.worldId)
  expect(reloaded.header.maxTilesX).toBe(original.header.maxTilesX)
  expect(reloaded.header.maxTilesY).toBe(original.header.maxTilesY)
  expect(reloaded.header.gameMode).toBe(original.header.gameMode)
  expect(reloaded.header.creationTime).toEqual(original.header.creationTime)
  expect(reloaded.header.lastPlayed).toEqual(original.header.lastPlayed)
  expect(reloaded.header.killCount).toEqual(original.header.killCount)
  expect(reloaded.header.claimableBanners).toEqual(original.header.claimableBanners)
  expect(reloaded.header.teamSpawns).toEqual(original.header.teamSpawns)
  expect(reloaded.header.worldManifestData).toBe(original.header.worldManifestData)
  expect(reloaded.header.moondialCooldown).toBe(original.header.moondialCooldown)

  // chests
  expect(reloaded.chests.chests.length).toBe(original.chests.chests.length)
  for (let i = 0; i < original.chests.chests.length; i++) {
    expect(reloaded.chests.chests[i].position).toEqual(original.chests.chests[i].position)
    expect(reloaded.chests.chests[i].maxItems).toBe(original.chests.chests[i].maxItems)
    expect(reloaded.chests.chests[i].items).toEqual(original.chests.chests[i].items)
  }

  // NPCs
  expect(reloaded.NPCs.townNPCs.length).toBe(original.NPCs.townNPCs.length)
  for (let i = 0; i < original.NPCs.townNPCs.length; i++) {
    expect(reloaded.NPCs.townNPCs[i].id).toBe(original.NPCs.townNPCs[i].id)
    expect(reloaded.NPCs.townNPCs[i].name).toBe(original.NPCs.townNPCs[i].name)
    expect(reloaded.NPCs.townNPCs[i].homelessDespawn).toBe(original.NPCs.townNPCs[i].homelessDespawn)
  }

  // tileEntities
  expect(reloaded.tileEntities.entities.length).toBe(original.tileEntities.entities.length)
  for (let i = 0; i < original.tileEntities.entities.length; i++) {
    expect(reloaded.tileEntities.entities[i]).toEqual(original.tileEntities.entities[i])
  }

  // footer
  expect(reloaded.footer.signoff1).toBe(original.footer.signoff1)
  expect(reloaded.footer.signoff2).toBe(original.footer.signoff2)
  expect(reloaded.footer.signoff3).toBe(original.footer.signoff3)
}

describe.skipIf(allWorlds.length === 0)('Round-trip: byte-perfect', () => {
  test.for(allWorlds.map((f) => [f.split(/[\\/]/).pop()!, f]))(
    '%s',
    { timeout: 60_000 },
    async ([_name, filePath]) => {
      await bytePerfectRoundTrip(filePath)
    },
  )
})

describe.skipIf(allWorlds.length === 0)('Round-trip: data-equal', () => {
  test.for(allWorlds.map((f) => [f.split(/[\\/]/).pop()!, f]))(
    '%s',
    { timeout: 60_000 },
    async ([_name, filePath]) => {
      await dataEqualRoundTrip(filePath)
    },
  )
})
