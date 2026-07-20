import type BinaryReader from '../BinaryReader'
import type { WeightedPressurePlate } from '../types'
import type { Section } from '../sections'
import type BinarySaver from '../BinarySaver'
import type { WorldProperties } from '../FileReader'

export class WeightedPressurePlatesData {
  weightedPressurePlates!: WeightedPressurePlate[]
}

export default class WeightedPressurePlatesIO implements Section.IODefinition<WeightedPressurePlatesData> {
  public parse(reader: BinaryReader, world: WorldProperties): WeightedPressurePlatesData {
    const data = new WeightedPressurePlatesData()

    data.weightedPressurePlates = reader.readArray(reader.readInt32(), () => this.parseWeightedPressurePlate(reader))

    return data
  }

  private parseWeightedPressurePlate(reader: BinaryReader): WeightedPressurePlate {
    return {
      position: {
        x: reader.readInt32(),
        y: reader.readInt32(),
      },
    }
  }

  public save(saver: BinarySaver, data: WeightedPressurePlatesData, world: WorldProperties): void {
    saver.saveArray(
      data.weightedPressurePlates,
      (length) => saver.saveInt32(length),
      (pressurePlate) => {
        saver.saveInt32(pressurePlate.position.x)
        saver.saveInt32(pressurePlate.position.y)
      },
    )
  }
}
