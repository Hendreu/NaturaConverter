import type BinaryReader from '../BinaryReader'
import {
  // @ts-ignore
  CritterAnchor,
  // @ts-ignore
  DeadCellsDisplayJar,
  // @ts-ignore
  DisplayDoll,
  // @ts-ignore
  FoodPlatter,
  // @ts-ignore
  HatRack,
  // @ts-ignore
  Item,
  // @ts-ignore
  ItemFrame,
  // @ts-ignore
  ItemSlot,
  // @ts-ignore
  KiteAnchor,
  // @ts-ignore
  LogicSensor,
  // @ts-ignore
  Pylon,
  // @ts-ignore
  TileEntity,
  // @ts-ignore
  TileEntityBase,
  // @ts-ignore
  TileEntityType,
  // @ts-ignore
  TrainingDummy,
  // @ts-ignore
  WeaponsRack,
} from '../types'
import type { Section } from '../sections'
import type { WorldProperties } from '../FileReader'
import type BinarySaver from '../BinarySaver'

export class TileEntitiesData {
  entities!: TileEntity[]
}

export default class TileEntitiesIO implements Section.IODefinition<TileEntitiesData> {
  public parse(reader: BinaryReader, world: WorldProperties): TileEntitiesData {
    const data = new TileEntitiesData()
    data.entities = reader.readArray(reader.readInt32(), () => this.parseEntity(reader, world))
    return data
  }

  private parseEntity(reader: BinaryReader, world: WorldProperties): TileEntity {
    const entity: TileEntityBase = {
      type: reader.readUInt8() as TileEntityType,
      id: reader.readInt32(),
      position: {
        x: reader.readInt16(),
        y: reader.readInt16(),
      },
    }

    switch (entity.type) {
      case TileEntityType.TrainingDummy:
        return this.parseTrainingDummy(reader, entity)
      case TileEntityType.ItemFrame:
        return this.parseItemFrame(reader, entity)
      case TileEntityType.LogicSensor:
        return this.parseLogicSensor(reader, entity)
      case TileEntityType.DisplayDoll:
        return this.parseDisplayDoll(reader, entity, world)
      case TileEntityType.WeaponsRack:
        return this.parseWeaponsRack(reader, entity)
      case TileEntityType.HatRack:
        return this.parseHatRack(reader, entity)
      case TileEntityType.FoodPlatter:
        return this.parseFoodPlatter(reader, entity)
      case TileEntityType.Pylon:
        return entity as Pylon
      case TileEntityType.DeadCellsDisplayJar:
        return this.parseDeadCellsDisplayJar(reader, entity)
      case TileEntityType.KiteAnchor:
        return this.parseKiteAnchor(reader, entity)
      case TileEntityType.CritterAnchor:
        return this.parseCritterAnchor(reader, entity)
    }
  }

  private parseTrainingDummy(reader: BinaryReader, entity: TileEntityBase): TrainingDummy {
    return {
      ...entity,
      type: TileEntityType.TrainingDummy,
      npc: reader.readInt16(),
    }
  }

  private parseItemFrame(reader: BinaryReader, entity: TileEntityBase): ItemFrame {
    return {
      ...entity,
      type: TileEntityType.ItemFrame,
      item: this.parseItem(reader),
    }
  }

  private parseLogicSensor(reader: BinaryReader, entity: TileEntityBase): LogicSensor {
    return {
      ...entity,
      type: TileEntityType.LogicSensor,
      logicCheck: reader.readUInt8(),
      on: reader.readBoolean(),
    }
  }

  private parseDisplayDoll(reader: BinaryReader, entity: TileEntityBase, world: WorldProperties): DisplayDoll {
    const itemSlotBits = reader.readBits(8)
    const dyeSlotBits = reader.readBits(8)

    let pose: number | undefined
    if (world.version >= 307) {
      pose = reader.readUInt8()
    }

    let extraSlotBits = [false, false, false]
    if (world.version >= 308) {
      const extraByte = reader.readUInt8()
      extraSlotBits = [Boolean(extraByte & 1), Boolean(extraByte & 2), Boolean(extraByte & 4)]
    }

    let v311ExtraItem = false
    if (world.version === 311) {
      v311ExtraItem = extraSlotBits[1]
      extraSlotBits[1] = false
    }

    const maxSlots = world.version >= 308 ? 9 : 8

    const items: ItemSlot[] = Array.from({ length: 9 }, () => null)
    const dyes: ItemSlot[] = Array.from({ length: 9 }, () => null)
    const misc: ItemSlot[] = [null]

    // Read items
    for (let i = 0; i < maxSlots; i++) {
      const hasItem = i < 8 ? itemSlotBits[i] : extraSlotBits[1]
      if (hasItem) {
        items[i] = this.parseItem(reader)
      }
    }

    // Read dyes
    for (let i = 0; i < maxSlots; i++) {
      const hasDye = i < 8 ? dyeSlotBits[i] : extraSlotBits[2]
      if (hasDye) {
        dyes[i] = this.parseItem(reader)
      }
    }

    // Read misc items (v308+, extraSlotBits[0])
    if (extraSlotBits[0]) {
      misc[0] = this.parseItem(reader)
    }

    // Version 311 special bug handling
    if (v311ExtraItem) {
      items[8] = this.parseItem(reader)
    }

    const result: DisplayDoll = {
      ...entity,
      type: TileEntityType.DisplayDoll,
      items,
      dyes,
    }

    if (pose !== undefined) {
      result.pose = pose
    }
    if (world.version >= 308) {
      result.misc = misc
    }

    return result
  }

  private parseWeaponsRack(reader: BinaryReader, entity: TileEntityBase): WeaponsRack {
    return {
      ...entity,
      type: TileEntityType.WeaponsRack,
      item: this.parseItem(reader),
    }
  }

  private parseHatRack(reader: BinaryReader, entity: TileEntityBase): HatRack {
    const numSlots = 2
    const slots = reader.readBits(8)

    const items: ItemSlot[] = []
    for (let i = 0; i < numSlots; i++) {
      items.push(slots[i] ? this.parseItem(reader) : null)
    }

    const dyes: ItemSlot[] = []
    for (let i = 0; i < numSlots; i++) {
      dyes.push(slots[i + numSlots] ? this.parseItem(reader) : null)
    }

    return {
      ...entity,
      type: TileEntityType.HatRack,
      items,
      dyes,
    }
  }

  private parseFoodPlatter(reader: BinaryReader, entity: TileEntityBase): FoodPlatter {
    return {
      ...entity,
      type: TileEntityType.FoodPlatter,
      item: this.parseItem(reader),
    }
  }

  private parseDeadCellsDisplayJar(reader: BinaryReader, entity: TileEntityBase): DeadCellsDisplayJar {
    return {
      ...entity,
      type: TileEntityType.DeadCellsDisplayJar,
      item: this.parseItem(reader),
    }
  }

  private parseKiteAnchor(reader: BinaryReader, entity: TileEntityBase): KiteAnchor {
    return {
      ...entity,
      type: TileEntityType.KiteAnchor,
      itemId: reader.readInt16(),
    }
  }

  private parseCritterAnchor(reader: BinaryReader, entity: TileEntityBase): CritterAnchor {
    return {
      ...entity,
      type: TileEntityType.CritterAnchor,
      itemId: reader.readInt16(),
    }
  }

  private parseItem(reader: BinaryReader): Item {
    return {
      id: reader.readInt16(),
      prefix: reader.readUInt8(),
      stack: reader.readInt16(),
    }
  }

  public save(saver: BinarySaver, data: TileEntitiesData, world: WorldProperties): void {
    saver.saveArray(
      data.entities,
      (length) => saver.saveInt32(length),
      (entity) => this.saveTileEntity(saver, entity, world),
    )
  }

  private saveTileEntity(saver: BinarySaver, entity: TileEntity, world: WorldProperties) {
    saver.saveUInt8(entity.type)
    saver.saveInt32(entity.id)
    saver.saveInt16(entity.position.x)
    saver.saveInt16(entity.position.y)

    switch (entity.type) {
      case TileEntityType.TrainingDummy:
        saver.saveInt16(entity.npc)
        break
      case TileEntityType.ItemFrame:
      case TileEntityType.WeaponsRack:
      case TileEntityType.FoodPlatter:
        this.saveItem(saver, entity.item)
        break
      case TileEntityType.LogicSensor:
        saver.saveUInt8(entity.logicCheck)
        saver.saveBoolean(entity.on)
        break
      case TileEntityType.DisplayDoll:
        this.saveDisplayDoll(saver, entity, world)
        break
      case TileEntityType.HatRack: {
        // Pack both item flags and dye flags into a single byte
        // bits 0-1: item slots, bits 2-3: dye slots
        const hatSlotBits = [
          ...entity.items.map((s) => s !== null),
          ...entity.dyes.map((s) => s !== null),
        ]
        saver.saveBits(hatSlotBits)
        for (const itemSlot of entity.items) {
          if (itemSlot !== null) this.saveItem(saver, itemSlot)
        }
        for (const dyeSlot of entity.dyes) {
          if (dyeSlot !== null) this.saveItem(saver, dyeSlot)
        }
        break
      }
      case TileEntityType.DeadCellsDisplayJar:
        this.saveItem(saver, entity.item)
        break
      case TileEntityType.CritterAnchor:
      case TileEntityType.KiteAnchor:
        saver.saveInt16(entity.itemId)
        break
    }
  }

  private saveDisplayDoll(saver: BinarySaver, entity: DisplayDoll, world: WorldProperties) {
    // Write first 8 item slot bits
    const itemBits = entity.items.slice(0, 8).map((s) => s !== null)
    saver.saveBits(itemBits)

    // Write first 8 dye slot bits
    const dyeBits = entity.dyes.slice(0, 8).map((s) => s !== null)
    saver.saveBits(dyeBits)

    // v307+: pose
    if (world.version >= 307) {
      saver.saveUInt8(entity.pose ?? 0)
    }

    // v308+: extra slots byte
    if (world.version >= 308) {
      let extraByte = 0
      if (entity.misc?.[0] !== null && entity.misc?.[0] !== undefined) extraByte |= 1
      if (entity.items[8] !== null && entity.items[8] !== undefined) extraByte |= 2
      if (entity.dyes[8] !== null && entity.dyes[8] !== undefined) extraByte |= 4
      saver.saveUInt8(extraByte)
    }

    const maxSlots = world.version >= 308 ? 9 : 8

    // Write item data
    for (let i = 0; i < maxSlots; i++) {
      if (entity.items[i] !== null && entity.items[i] !== undefined) {
        this.saveItem(saver, entity.items[i])
      }
    }

    // Write dye data
    for (let i = 0; i < maxSlots; i++) {
      if (entity.dyes[i] !== null && entity.dyes[i] !== undefined) {
        this.saveItem(saver, entity.dyes[i])
      }
    }

    // v308+: misc data
    if (world.version >= 308 && entity.misc) {
      for (let i = 0; i < entity.misc.length; i++) {
        if (entity.misc[i] !== null && entity.misc[i] !== undefined) {
          this.saveItem(saver, entity.misc[i])
        }
      }
    }
  }

  private saveItem(saver: BinarySaver, item: ItemSlot) {
    if (item !== null) {
      saver.saveInt16(item.id)
      saver.saveUInt8(item.prefix)
      saver.saveInt16(item.stack)
    }
  }
}
