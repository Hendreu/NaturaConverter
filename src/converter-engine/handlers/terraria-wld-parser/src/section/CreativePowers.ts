import { CreativePowerType } from '../types'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'
import type BinaryReader from '../BinaryReader'
import type { Section } from '../sections'

export class CreativePowersData {
  freezeTime!: boolean
  modifyTimeRate!: number
  freezeRainPower!: boolean
  freezeWindDirectionAndStrength!: boolean
  difficultySliderPower!: number
  stopBiomeSpreadPower!: boolean
}

export default class CreativePowersIO implements Section.IODefinition<CreativePowersData> {
  public parse(reader: BinaryReader): CreativePowersData {
    const data = new CreativePowersData()

    const powers = reader.readArrayUntil(
      () => reader.readBoolean(),
      () => this.parseCreativePower(reader),
    )

    for (const [powerType, value] of powers) {
      const powerName = CreativePowerType[powerType] as keyof typeof CreativePowerType,
        powerNameUncapitalized = (powerName.charAt(0).toLowerCase() + powerName.slice(1)) as Uncapitalize<
          keyof typeof CreativePowerType
        >

      // @ts-ignore
      data[powerNameUncapitalized] = value
    }

    return data
  }

  private parseCreativePower(reader: BinaryReader): [CreativePowerType, number | boolean] {
    const type = reader.readUInt16()

    switch (type) {
      case CreativePowerType.FreezeTime:
        return [type, reader.readBoolean()]
      case CreativePowerType.ModifyTimeRate:
        return [type, reader.readFloat32()]
      case CreativePowerType.FreezeRainPower:
        return [type, reader.readBoolean()]
      case CreativePowerType.FreezeWindDirectionAndStrength:
        return [type, reader.readBoolean()]
      case CreativePowerType.DifficultySliderPower:
        return [type, reader.readFloat32()]
      case CreativePowerType.StopBiomeSpreadPower:
        return [type, reader.readBoolean()]
      default:
        return [type, 0]
    }
  }

  save(saver: BinarySaver, data: CreativePowersData, world: WorldProperties): void {
    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.FreezeTime)
    saver.saveBoolean(data.freezeTime)

    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.ModifyTimeRate)
    saver.saveFloat32(data.modifyTimeRate)

    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.FreezeRainPower)
    saver.saveBoolean(data.freezeRainPower)

    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.FreezeWindDirectionAndStrength)
    saver.saveBoolean(data.freezeWindDirectionAndStrength)

    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.DifficultySliderPower)
    saver.saveFloat32(data.difficultySliderPower)

    saver.saveBoolean(true)
    saver.saveInt16(CreativePowerType.StopBiomeSpreadPower)
    saver.saveBoolean(data.stopBiomeSpreadPower)

    saver.saveBoolean(false)
  }
}
