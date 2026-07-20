import FileFormatHeaderIO from './section/FileFormatHeader'
import HeaderIO from './section/Header'
import WorldTilesIO from './section/WorldTiles'
import SignsIO from './section/Signs'
import ChestsIO from './section/Chests'
import NPCsIO from './section/NPCs'
import FooterIO from './section/Footer'
import CreativePowersIO from './section/CreativePowers'
import BestiaryIO from './section/Bestiary'
import TownManagerIO from './section/TownManager'
import WeightedPressurePlatesIO from './section/WeightedPressurePlates'
import TileEntitiesIO from './section/TileEntities'

import type BinaryReader from './BinaryReader'
import type { WorldProperties } from './FileReader'
import type BinarySaver from './BinarySaver'

const sections: {
  readonly fileFormatHeader: FileFormatHeaderIO
  readonly header: HeaderIO
  readonly worldTiles: WorldTilesIO
  readonly chests: ChestsIO
  readonly signs: SignsIO
  readonly NPCs: NPCsIO
  readonly tileEntities: TileEntitiesIO
  readonly weightedPressurePlates: WeightedPressurePlatesIO
  readonly townManager: TownManagerIO
  readonly bestiary: BestiaryIO
  readonly creativePowers: CreativePowersIO
  readonly footer: FooterIO
} = {
  fileFormatHeader: new FileFormatHeaderIO(),
  header: new HeaderIO(),
  worldTiles: new WorldTilesIO(),
  chests: new ChestsIO(),
  signs: new SignsIO(),
  NPCs: new NPCsIO(),
  tileEntities: new TileEntitiesIO(),
  weightedPressurePlates: new WeightedPressurePlatesIO(),
  townManager: new TownManagerIO(),
  bestiary: new BestiaryIO(),
  creativePowers: new CreativePowersIO(),
  footer: new FooterIO(),
} as const

export namespace Section {
  export interface IODefinition<T> {
    parse(reader: BinaryReader, world: WorldProperties): T
    save(saver: BinarySaver, data: T, world: WorldProperties): void
  }

  export type Name = keyof typeof sections
  export type Data<T extends Name> = (typeof sections)[T] extends IODefinition<infer R> ? R : any
  export type DataMap = { [K in Name]: Data<K> }
  export type IO<T extends Name = Name> = IODefinition<Data<T>>
}

export default sections as { [K in Section.Name]: Section.IO<K> }
