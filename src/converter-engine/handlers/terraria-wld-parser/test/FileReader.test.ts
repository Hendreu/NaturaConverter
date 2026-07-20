import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { fileLoader } from '../src/platform/node'
import { FileReader, Liquid, Slope, GameMode } from '../src'

const testFilePath = import.meta.dirname + '/test.wld'
const hasTestFile = existsSync(testFilePath)

const fileReaderTest = test.extend<{ reader: FileReader }>({
  reader: async ({}, use) => {
    await use(await new FileReader().loadFile(fileLoader, testFilePath))
  },
})

describe.skipIf(!hasTestFile).concurrent('File reader', () => {
  test('Node buffer loading', async () => {
    const buffer = await fileLoader(testFilePath)
    await expect(fileLoader(testFilePath)).resolves.toBeInstanceOf(ArrayBuffer)
    await expect(new FileReader().loadBuffer(buffer)).resolves.toBeInstanceOf(FileReader)
  })

  test('Node file loading', async () => {
    await expect(new FileReader().loadFile(fileLoader, testFilePath)).resolves.toBeInstanceOf(FileReader)
  })

  fileReaderTest('Preflight', async ({ reader }) => {
    expect(reader.parse({ sections: [] })).toEqual({})
  })

  fileReaderTest('fileFormatHeader', async ({ reader }) => {
    const parsed = reader.parse({ sections: ['fileFormatHeader'] })
    expect(Object.keys(parsed).length).toEqual(1)
    expect(parsed.fileFormatHeader.magicNumber).toEqual('relogic')
  })

  fileReaderTest('header', async ({ reader }) => {
    const parsed = reader.parse({ sections: ['header'] })
    expect(Object.keys(parsed).length).toEqual(1)
    expect(parsed.header.mapName).toEqual('test2')
    expect(parsed.header.gameMode).toEqual(GameMode.NormalMode)
  })

  fileReaderTest('worldTiles', async ({ reader }) => {
    const parsed = reader.parse({ sections: ['worldTiles'] })
    expect(Object.keys(parsed).length).toEqual(1)
    const tiles = parsed.worldTiles.tiles
    expect(tiles.width).toEqual(8400)
    expect(tiles.height).toEqual(2400)
    expect(tiles.getTile(2166, 751)).toEqual({
      blockId: 231,
      frameX: 18,
      frameY: 18,
      liquidAmount: 255,
      liquidType: 3,
      wallId: 86,
    })
    expect(tiles.getTile(1037, 488)).toEqual({
      blockId: 2,
      slope: Slope.TL,
    })
    expect(tiles.getTile(550, 1150)).toEqual({
      liquidAmount: 255,
      liquidType: Liquid.Shimmer,
    })
    expect(tiles.getTile(4167, 530)).toEqual({
      blockId: 52,
      liquidAmount: 255,
      liquidType: Liquid.Water,
      wallId: 2,
    })
    // RLE oftentimes drifts in corrupted parses
    expect(tiles.getTile(8398, 0)).toEqual({})
    expect(tiles.getTile(8398, 2398)).toEqual({ blockId: 57 })
  })

  fileReaderTest('chests', async ({ reader }) => {
    const parsed = reader.parse({ sections: ['chests'] })
    expect(Object.keys(parsed).length).toEqual(1)
    expect(parsed.chests.chests.length).toEqual(526)
    expect(parsed.chests.chests[0].position).toEqual({ x: 3240, y: 2249 })
    expect(parsed.chests.chests[3].items![0]).toEqual({ id: 1156, prefix: 82, stack: 1 })
    expect(parsed.chests.chests[3].items![39]).toEqual(null)
  })

  fileReaderTest('footer', async ({ reader }) => {
    const parsed = reader.parse({ sections: ['footer'] })
    expect(Object.keys(parsed).length).toEqual(1)
    expect(parsed.footer.signoff1).toEqual(true)
    expect(parsed.footer.signoff2).toEqual('test2')
    expect(parsed.footer.signoff3).toEqual(1264713569)
  })
})
