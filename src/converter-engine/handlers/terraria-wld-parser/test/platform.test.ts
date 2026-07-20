import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { fileLoader } from '../src/platform/node'

const testDir = import.meta.dirname
const worldFiles = readdirSync(testDir).filter((f) => f.endsWith('.wld'))
const testFilePath = worldFiles.length > 0 ? join(testDir, worldFiles[0]) : null

describe.concurrent('Terraria World File platform specific functions', () => {
  test.skipIf(!testFilePath)('Node file loader', () => {
    expect(fileLoader(testFilePath!)).toBeInstanceOf(Promise)
  })

  test.skipIf(!testFilePath)('Node file loader resolves', async () => {
    await expect(fileLoader(testFilePath!)).resolves.toBeInstanceOf(ArrayBuffer)
  })

  test('Node file loader fails', async () => {
    await expect(fileLoader('./non/existent.wld')).rejects.toThrow()
  })
})
