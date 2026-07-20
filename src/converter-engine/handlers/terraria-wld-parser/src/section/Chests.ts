import type BinaryReader from '../BinaryReader'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'
import type { Section } from '../sections'
import type { Chest, Item } from '../types'

export class ChestsData {
  public chests!: Chest[]
}

export default class ChestsIO implements Section.IODefinition<ChestsData> {
  parse(reader: BinaryReader, world: WorldProperties): ChestsData {
    const data = new ChestsData()

    const totalChests = reader.readInt16()
    const globalMaxItems = world.version < 294 ? reader.readInt16() : 40

    data.chests = reader.readArray(totalChests, () => this.parseChest(reader, world, globalMaxItems))

    return data
  }

  private parseChest(reader: BinaryReader, world: WorldProperties, globalMaxItems: number): Chest {
    const data: Chest = {
      position: {
        x: reader.readInt32(),
        y: reader.readInt32(),
      },
      name: reader.readString(),
    }

    const maxItems = world.version >= 294 ? reader.readInt32() : globalMaxItems
    if (world.version >= 294) {
      data.maxItems = maxItems
    }
    data.items = reader.readArray(maxItems, () => this.parseItem(reader)).map((item) => (item.stack ? item : null))

    if (!data.name) {
      delete data.name
    }

    if (!data.items) {
      delete data.items
    }

    return data
  }

  private parseItem(reader: BinaryReader): Item {
    const stack = reader.readInt16()

    return {
      stack,
      id: Number(stack && reader.readInt32()),
      prefix: Number(stack && reader.readUInt8()),
    }
  }

  save(saver: BinarySaver, data: ChestsData, world: WorldProperties): void {
    saver.saveInt16(data.chests.length)
    if (world.version < 294) {
      saver.saveInt16(40)
    }

    data.chests.forEach((chest) => {
      saver.saveInt32(chest.position.x)
      saver.saveInt32(chest.position.y)

      if (chest.name) {
        saver.saveString(chest.name)
      } else {
        saver.saveUInt8(0)
      }

      const maxItems = world.version >= 294 ? (chest.maxItems ?? 40) : 40
      if (world.version >= 294) {
        saver.saveInt32(maxItems)
      }

      for (let i = 0; i < maxItems; i++) {
        const item = chest.items?.[i]
        if (item == null) {
          saver.saveInt16(0)
        } else {
          saver.saveInt16(item.stack)
          saver.saveInt32(item.id)
          saver.saveUInt8(item.prefix)
        }
      }
    })
  }
}
