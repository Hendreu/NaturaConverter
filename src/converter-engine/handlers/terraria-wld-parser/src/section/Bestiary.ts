import type BinaryReader from '../BinaryReader'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'
import type { Section } from '../sections'

export class BestiaryData {
  public NPCKills!: { [k: string]: number }
  public NPCSights!: string[]
  public NPCChats!: string[]
}

export default class BestiaryIO implements Section.IODefinition<BestiaryData> {
  public parse(reader: BinaryReader, world: WorldProperties): BestiaryData {
    const data = new BestiaryData()

    data.NPCKills = Object.fromEntries(
      reader.readArray(reader.readInt32(), () => [reader.readString(), reader.readInt32()]),
    )
    data.NPCSights = reader.readArray(reader.readInt32(), () => reader.readString())
    data.NPCChats = reader.readArray(reader.readInt32(), () => reader.readString())

    return data
  }

  public save(saver: BinarySaver, data: BestiaryData, world: WorldProperties): void {
    saver.saveArray(
      Object.entries(data.NPCKills),
      (length) => saver.saveInt32(length),
      ([name, count]) => {
        saver.saveString(name)
        saver.saveInt32(count)
      },
    )

    saver.saveArray(
      data.NPCSights,
      (length) => saver.saveInt32(length),
      (e) => saver.saveString(e),
    )

    saver.saveArray(
      data.NPCChats,
      (length) => saver.saveInt32(length),
      (e) => saver.saveString(e),
    )
  }
}
