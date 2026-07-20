import type BinaryReader from '../BinaryReader'
import type { TownRoom } from '../types'
import type { Section } from '../sections'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'

export class TownManagerData {
  public rooms!: TownRoom[]
}

export default class TownManagerIO implements Section.IODefinition<TownManagerData> {
  public parse(reader: BinaryReader, world: WorldProperties): TownManagerData {
    const data = new TownManagerData()

    data.rooms = reader.readArray(reader.readInt32(), () => this.parseTownRoom(reader))

    return data
  }

  private parseTownRoom(reader: BinaryReader): TownRoom {
    return {
      NPCId: reader.readInt32(),
      position: {
        x: reader.readInt32(),
        y: reader.readInt32(),
      },
    }
  }

  public save(saver: BinarySaver, data: TownManagerData, world: WorldProperties): void {
    saver.saveArray(
      data.rooms,
      (length) => saver.saveInt32(length),
      (room) => {
        saver.saveInt32(room.NPCId)
        saver.saveInt32(room.position.x)
        saver.saveInt32(room.position.y)
      },
    )
  }
}
