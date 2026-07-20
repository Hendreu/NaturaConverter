import type BinaryReader from '../BinaryReader'
import type { WorldProperties } from '../FileReader'
import type BinarySaver from '../BinarySaver'
import type { Section } from '../sections'

export class FileFormatHeaderData {
  public version!: number
  public magicNumber!: 'relogic'
  public fileType!: 2
  public revision!: number
  public favorite!: boolean
  public pointers!: number[]
  public importants!: boolean[]
}

export default class FileFormatHeaderIO implements Section.IODefinition<FileFormatHeaderData> {
  public parse(reader: BinaryReader): FileFormatHeaderData {
    const data = new FileFormatHeaderData()

    data.version = reader.readInt32()
    data.magicNumber = reader.readString(7) as 'relogic'
    data.fileType = reader.readUInt8() as 2
    data.revision = reader.readUInt32()
    data.favorite = Boolean(reader.readInt64())
    data.pointers = reader.readArray(reader.readInt16(), () => reader.readInt32())
    data.importants = reader.readBits(reader.readUInt16())

    return data
  }

  public save(saver: BinarySaver, data: FileFormatHeaderData, world: WorldProperties): void {
    saver.saveInt32(data.version)
    saver.saveString('relogic', false)
    saver.saveUInt8(data.fileType)
    saver.saveUInt32(data.revision)
    saver.saveInt64(BigInt(data.favorite))
    saver.skipBytes(world.version >= 225 ? 46 : 42)
    saver.saveUInt16(data.importants.length)
    saver.saveBits(data.importants)
  }
}
