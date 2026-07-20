import type BinaryReader from '../BinaryReader'
import type { Section } from '../sections'
import type { WorldProperties } from '../FileReader'
import BinarySaver from '../BinarySaver'

export class FooterData {
  public signoff1!: boolean
  public signoff2!: string
  public signoff3!: number
}

export default class FooterIO implements Section.IODefinition<FooterData> {
  public parse(reader: BinaryReader, world: WorldProperties): FooterData {
    const data = new FooterData()

    data.signoff1 = reader.readBoolean()
    data.signoff2 = reader.readString()
    data.signoff3 = reader.readInt32()

    return data
  }

  save(saver: BinarySaver, data: FooterData, world: WorldProperties): void {
    saver.saveBoolean(true)
    saver.saveString(world.mapName)
    saver.saveInt32(world.worldId)
  }
}
