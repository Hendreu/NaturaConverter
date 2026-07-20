import type BinaryReader from '../BinaryReader'
import type { Section } from '../sections'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'
import type { Sign } from '../types'

export class SignsData {
  public signs!: Sign[]
}

export default class SignsIO implements Section.IODefinition<SignsData> {
  public parse(reader: BinaryReader): SignsData {
    const data = new SignsData()

    data.signs = reader.readArray(reader.readInt16(), () => this.parseSign(reader))

    return data
  }

  private parseSign(reader: BinaryReader): Sign {
    return {
      text: reader.readString(),
      position: {
        x: reader.readInt32(),
        y: reader.readInt32(),
      },
    }
  }

  public save(saver: BinarySaver, data: SignsData, world: WorldProperties): void {
    saver.saveInt16(data.signs.length)

    data.signs.forEach((sign) => {
      saver.saveString(sign.text)
      saver.saveInt32(sign.position.x)
      saver.saveInt32(sign.position.y)
    })
  }
}
