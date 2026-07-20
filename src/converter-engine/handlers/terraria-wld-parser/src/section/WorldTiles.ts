import type { WorldProperties } from '../FileReader'
import type BinaryReader from '../BinaryReader'
import type BinarySaver from '../BinarySaver'
import type { Section } from '../sections'
import { Liquid, TileFlag } from '../types'
import { TileData } from '../TileData'

export class WorldTilesData {
  public tiles!: TileData
}

const enum FLAG_1 {
  FLAG_2_EXISTS = 1,
  BLOCK_ID_1 = 2,
  WALL_ID_1 = 4,
  LIQUID_ID_1 = 8,
  LIQUID_ID_2 = 16,
  BLOCK_ID_2 = 32,
  RLE_1 = 64,
  RLE_2 = 128,

  IS_WATER = 8,
  IS_LAVA = 16,
  IS_HONEY = 24,
  LIQUID_ID = 24, // LIQUID_ID_1 + LIQUID_ID_2
  LIQUID_ID_OFFSET = 3,
  RLE = 192,
  IS_NOT_EMPTY = 62, // BLOCK_ID + WALL_ID + LIQUID_ID_1 + LIQUID_ID_2 + BLOCK_ID_2
}

const enum FLAG_2 {
  FLAG_3_EXISTS = 1,
  IS_RED_WIRE = 2,
  IS_BLUE_WIRE = 4,
  IS_GREEN_WIRE = 8,
  SLOPE_ID_1 = 16,
  SLOPE_ID_2 = 32,
  SLOPE_ID_3 = 64,

  SLOPE_ID = 112, // SLOPE_ID_1 + SLOPE_ID_2 + SLOPE_ID_3
  SLOPE_ID_OFFSET = 4,
  IS_NOT_EMPTY = 126, //IS_RED_WIRE + IS_BLUE_WIRE + IS_GREEN_WIRE + SLOPE_ID_1 + SLOPE_ID_2 + SLOPE_ID_3
}

const enum FLAG_3 {
  FLAG_4_EXISTS = 1,
  IS_ACTUATOR = 2,
  IS_ACTUATED = 4,
  BLOCK_COLOR_ID = 8,
  WALL_COLOR_ID = 16,
  IS_YELLOW_WIRE = 32,
  WALL_ID_2 = 64,
  IS_SHIMMER_LIQUID = 128,

  IS_NOT_EMPTY = 126, // IS_ACTUATOR + IS_ACTUATED + BLOCK_COLOR_ID + WALL_COLOR_ID + IS_YELLOW_WIRE + WALL_ID_2
}

const enum FLAG_4 {
  IS_INVISIBLE_BLOCK = 2,
  IS_INVISIBLE_WALL = 4,
  IS_FULL_BRIGHT_BLOCK = 8,
  IS_FULL_BRIGHT_WALL = 16,
}

export default class WorldTilesIO implements Section.IODefinition<WorldTilesData> {
  private RLE!: number

  public parse(reader: BinaryReader, world: WorldProperties): WorldTilesData {
    const data = new WorldTilesData()
    this.RLE = 0

    const tiles = new TileData(world.width, world.height)
    data.tiles = tiles

    for (let x = 0; x < world.width; x++) {
      for (let y = 0; y < world.height; y++) {
        const i = x * world.height + y
        this.parseTileData(reader, world, tiles, i)

        while (this.RLE) {
          y++
          tiles.copyTile(i, x * world.height + y)
          this.RLE--
        }
      }
    }

    return data
  }

  public save(saver: BinarySaver, data: WorldTilesData, world: WorldProperties): void {
    const tiles = data.tiles
    const worldTilesCount = world.width * world.height

    for (let x = 0; x < world.width; x++) {
      for (let y = 0; y < world.height; ) {
        const i = x * world.height + y
        this.RLE = 0

        let nextY = y + 1
        while (nextY < world.height && tiles.tilesEqual(i, x * world.height + nextY)) {
          if (world.version >= 232) {
            const blockId = tiles.blockId[i]
            if (blockId == 520 || blockId == 423) {
              break
            }
          }
          this.RLE++
          nextY++
        }

        this.saveTileData(saver, world, tiles, i)
        y = nextY

        if (
          saver.progressCallback &&
          ((x * world.height + y) / worldTilesCount) * 100 > saver.progress + 1 &&
          saver.progress != 100
        ) {
          saver.progressCallback(++saver.progress)
        }
      }
    }
  }

  private parseTileData(reader: BinaryReader, world: WorldProperties, tiles: TileData, i: number): void {
    let tileFlags = 0

    const flags1 = reader.readUInt8()
    let flags2 = 0,
      flags3 = 0,
      flags4 = 0

    if (flags1 & FLAG_1.FLAG_2_EXISTS) {
      flags2 = reader.readUInt8()

      if (flags2 & FLAG_2.FLAG_3_EXISTS) {
        flags3 = reader.readUInt8()

        if (flags3 & FLAG_3.FLAG_4_EXISTS) {
          flags4 = reader.readUInt8()
        }
      }
    }

    if (flags1 & FLAG_1.IS_NOT_EMPTY) {
      if (flags1 & FLAG_1.BLOCK_ID_1) {
        tileFlags |= TileFlag.IS_BLOCK_ACTIVE

        if (flags1 & FLAG_1.BLOCK_ID_2) {
          tiles.blockId[i] = reader.readUInt16()
        } else {
          tiles.blockId[i] = reader.readUInt8()
        }

        if (world.importants[tiles.blockId[i]]) {
          tiles.frameX[i] = reader.readInt16()
          tiles.frameY[i] = reader.readInt16()
          if (tiles.blockId[i] == 144) {
            tiles.frameY[i] = 0
          }
        }

        if (flags3 & FLAG_3.BLOCK_COLOR_ID) {
          tiles.blockColor[i] = reader.readUInt8()
        }
      }

      if (flags1 & FLAG_1.WALL_ID_1) {
        tiles.wallId[i] = reader.readUInt8()

        if (flags3 & FLAG_3.WALL_COLOR_ID) {
          tiles.wallColor[i] = reader.readUInt8()
        }
      }

      const liquidType = (flags1 & FLAG_1.LIQUID_ID) >> FLAG_1.LIQUID_ID_OFFSET
      if (liquidType) {
        tiles.liquidAmount[i] = reader.readUInt8()

        if (flags3 & FLAG_3.IS_SHIMMER_LIQUID) {
          tiles.liquidType[i] = Liquid.Shimmer
        } else {
          tiles.liquidType[i] = liquidType
        }
      }
    }

    if (flags2) {
      if (flags2 & FLAG_2.IS_NOT_EMPTY) {
        if (flags2 & FLAG_2.IS_RED_WIRE) tileFlags |= TileFlag.WIRE_RED
        if (flags2 & FLAG_2.IS_BLUE_WIRE) tileFlags |= TileFlag.WIRE_BLUE
        if (flags2 & FLAG_2.IS_GREEN_WIRE) tileFlags |= TileFlag.WIRE_GREEN

        const slope = (flags2 & FLAG_2.SLOPE_ID) >> FLAG_2.SLOPE_ID_OFFSET
        if (slope) {
          tileFlags |= (slope << TileFlag.SLOPE_SHIFT)
        }
      }

      if (flags3) {
        if (flags3 & FLAG_3.IS_NOT_EMPTY) {
          if (flags3 & FLAG_3.IS_ACTUATOR) tileFlags |= TileFlag.ACTUATOR
          if (flags3 & FLAG_3.IS_ACTUATED) tileFlags |= TileFlag.ACTUATED
          if (flags3 & FLAG_3.IS_YELLOW_WIRE) tileFlags |= TileFlag.WIRE_YELLOW

          if (flags3 & FLAG_3.WALL_ID_2) {
            reader.skipBytes(1)
            tiles.wallId[i] = 256 + tiles.wallId[i]
          }
        }

        if (flags4) {
          if (flags4 & FLAG_4.IS_INVISIBLE_BLOCK) tileFlags |= TileFlag.INVISIBLE_BLOCK
          if (flags4 & FLAG_4.IS_INVISIBLE_WALL) tileFlags |= TileFlag.INVISIBLE_WALL
          if (flags4 & FLAG_4.IS_FULL_BRIGHT_BLOCK) tileFlags |= TileFlag.FULL_BRIGHT_BLOCK
          if (flags4 & FLAG_4.IS_FULL_BRIGHT_WALL) tileFlags |= TileFlag.FULL_BRIGHT_WALL
        }
      }
    }

    tiles.flags[i] = tileFlags

    switch (flags1 & FLAG_1.RLE) {
      case FLAG_1.RLE_1:
        this.RLE = reader.readUInt8()
        break
      case FLAG_1.RLE_2:
        this.RLE = reader.readInt16()
        break
    }
  }

  private saveTileData(saver: BinarySaver, world: WorldProperties, tiles: TileData, i: number): void {
    const tileFlags = tiles.flags[i]
    const hasBlock = tileFlags & TileFlag.IS_BLOCK_ACTIVE
    const blockId = tiles.blockId[i]
    const wallId = tiles.wallId[i]
    const liquidAmount = tiles.liquidAmount[i]
    const liquidType = tiles.liquidType[i]
    const blockColor = tiles.blockColor[i]
    const wallColor = tiles.wallColor[i]
    const slope = (tileFlags & TileFlag.SLOPE_MASK) >> TileFlag.SLOPE_SHIFT

    let flags1 = 0,
      flags2 = 0,
      flags3 = 0,
      flags4 = 0

    if (this.RLE) {
      flags1 |= this.RLE > 255 ? FLAG_1.RLE_2 : FLAG_1.RLE_1
    }

    if (hasBlock) {
      flags1 |= FLAG_1.BLOCK_ID_1

      if (blockId > 255) {
        flags1 |= FLAG_1.BLOCK_ID_2
      }
    }

    if (wallId) {
      flags1 |= FLAG_1.WALL_ID_1

      if (wallId > 255) {
        flags3 |= FLAG_3.WALL_ID_2
      }
    }

    if (liquidAmount) {
      if (liquidType == 4) {
        flags1 |= FLAG_1.IS_WATER
        flags3 |= FLAG_3.IS_SHIMMER_LIQUID
      } else {
        flags1 |= liquidType << FLAG_1.LIQUID_ID_OFFSET
      }
    }

    if (slope) {
      flags2 |= slope << FLAG_2.SLOPE_ID_OFFSET
    }

    flags2 |= (tileFlags & TileFlag.WIRE_RED) ? FLAG_2.IS_RED_WIRE : 0
    flags2 |= (tileFlags & TileFlag.WIRE_BLUE) ? FLAG_2.IS_BLUE_WIRE : 0
    flags2 |= (tileFlags & TileFlag.WIRE_GREEN) ? FLAG_2.IS_GREEN_WIRE : 0
    flags3 |= (tileFlags & TileFlag.WIRE_YELLOW) ? FLAG_3.IS_YELLOW_WIRE : 0
    flags3 |= (tileFlags & TileFlag.ACTUATOR) ? FLAG_3.IS_ACTUATOR : 0
    flags3 |= (tileFlags & TileFlag.ACTUATED) ? FLAG_3.IS_ACTUATED : 0
    flags3 |= blockColor ? FLAG_3.BLOCK_COLOR_ID : 0
    flags3 |= wallColor ? FLAG_3.WALL_COLOR_ID : 0
    flags4 |= (tileFlags & TileFlag.INVISIBLE_BLOCK) ? FLAG_4.IS_INVISIBLE_BLOCK : 0
    flags4 |= (tileFlags & TileFlag.INVISIBLE_WALL) ? FLAG_4.IS_INVISIBLE_WALL : 0
    flags4 |= (tileFlags & TileFlag.FULL_BRIGHT_BLOCK) ? FLAG_4.IS_FULL_BRIGHT_BLOCK : 0
    flags4 |= (tileFlags & TileFlag.FULL_BRIGHT_WALL) ? FLAG_4.IS_FULL_BRIGHT_WALL : 0

    if (flags4) {
      saver.saveUInt8(flags1 | FLAG_1.FLAG_2_EXISTS)
      saver.saveUInt8(flags2 | FLAG_2.FLAG_3_EXISTS)
      saver.saveUInt8(flags3 | FLAG_3.FLAG_4_EXISTS)
      saver.saveUInt8(flags4)
    } else if (flags3) {
      saver.saveUInt8(flags1 | FLAG_1.FLAG_2_EXISTS)
      saver.saveUInt8(flags2 | FLAG_2.FLAG_3_EXISTS)
      saver.saveUInt8(flags3)
    } else if (flags2) {
      saver.saveUInt8(flags1 | FLAG_1.FLAG_2_EXISTS)
      saver.saveUInt8(flags2)
    } else {
      saver.saveUInt8(flags1)
    }

    if (hasBlock) {
      if (blockId > 255) {
        saver.saveUInt16(blockId)
      } else {
        saver.saveUInt8(blockId)
      }

      if (world.importants[blockId]) {
        saver.saveInt16(tiles.frameX[i])
        saver.saveInt16(tiles.frameY[i])
      }

      if (blockColor) {
        saver.saveUInt8(blockColor)
      }
    }

    if (wallId) {
      saver.saveUInt8(wallId)

      if (wallColor) {
        saver.saveUInt8(wallColor)
      }
    }

    if (liquidAmount) {
      saver.saveUInt8(liquidAmount)
    }

    if (flags3 & FLAG_3.WALL_ID_2) {
      // we don't have more than 512 wall ids
      saver.saveUInt8(1)
    }

    if (this.RLE > 255) {
      saver.saveUInt16(this.RLE)
    } else if (this.RLE) {
      saver.saveUInt8(this.RLE)
    }
  }
}
