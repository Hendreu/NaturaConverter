export enum GameMode {
  NormalMode,
  ExpertMode,
  MasterMode,
  CreativeMode,
}

export type Tile = {
  blockId?: number
  frameX?: number
  frameY?: number
  blockColor?: number
  wallId?: number
  wallColor?: number
  liquidAmount?: number
  liquidType?: Liquid
  wireRed?: boolean
  wireBlue?: boolean
  wireGreen?: boolean
  slope?: Slope
  actuator?: boolean
  actuated?: boolean
  wireYellow?: boolean
  invisibleBlock?: boolean
  invisibleWall?: boolean
  fullBrightBlock?: boolean
  fullBrightWall?: boolean
}

export enum Slope {
  Half = 1,
  TR,
  TL,
  BR,
  BL,
}

export const TileFlag = {
  IS_BLOCK_ACTIVE: 1 << 0,
  WIRE_RED: 1 << 1,
  WIRE_BLUE: 1 << 2,
  WIRE_GREEN: 1 << 3,
  WIRE_YELLOW: 1 << 4,
  ACTUATOR: 1 << 5,
  ACTUATED: 1 << 6,
  INVISIBLE_BLOCK: 1 << 7,
  INVISIBLE_WALL: 1 << 8,
  FULL_BRIGHT_BLOCK: 1 << 9,
  FULL_BRIGHT_WALL: 1 << 10,
  SLOPE_SHIFT: 11,
  SLOPE_MASK: 0x7 << 11, // 3 bits for slope (values 0-5)
} as const

export enum Liquid {
  Water = 1,
  Lava,
  Honey,
  Shimmer,
}

export type Position = {
  x: number
  y: number
}

export type Item = {
  stack: number
  id: number
  prefix: number
}

export type ItemSlot = Item | null

export type Chest = {
  position: Position
  name?: string
  items?: ItemSlot[]
  maxItems?: number
}

export type Sign = {
  text: string
  position: Position
}

export interface Pillar {
  id: number
  position: Position
}

export interface TownNPC extends Pillar {
  name: string
  homeless: boolean
  homePosition: Position
  variationIndex?: number
  shimmered?: boolean
  homelessDespawn?: boolean
}

export type TownRoom = {
  NPCId: number
  position: Position
}

export type WeightedPressurePlate = {
  position: {
    x: number
    y: number
  }
}

export enum TileEntityType {
  TrainingDummy,
  ItemFrame,
  LogicSensor,
  DisplayDoll,
  WeaponsRack,
  HatRack,
  FoodPlatter,
  Pylon,
  DeadCellsDisplayJar,
  KiteAnchor,
  CritterAnchor,
}

export interface TileEntityBase {
  type: TileEntityType
  id: number
  position: {
    x: number
    y: number
  }
}

export interface TrainingDummy extends TileEntityBase {
  type: TileEntityType.TrainingDummy
  npc: number
}

export interface ItemFrame extends TileEntityBase {
  type: TileEntityType.ItemFrame
  item: Item
}

export interface LogicSensor extends TileEntityBase {
  type: TileEntityType.LogicSensor
  logicCheck: number
  on: boolean
}

export interface DisplayDoll extends TileEntityBase {
  type: TileEntityType.DisplayDoll
  items: ItemSlot[]
  dyes: ItemSlot[]
  pose?: number
  misc?: ItemSlot[]
}

export enum DisplayDollSlot {
  Armor_Head,
  Armor_Shirt,
  Armor_Legs,
  Acc_1,
  Acc_2,
  Acc_3,
  Acc_4,
  Acc_5,
}

export interface WeaponsRack extends TileEntityBase {
  type: TileEntityType.WeaponsRack
  item: Item
}

export interface HatRack extends TileEntityBase {
  type: TileEntityType.HatRack
  items: ItemSlot[]
  dyes: ItemSlot[]
}

export enum HatRackSlot {
  LeftHat,
  RightHat,
}

export interface FoodPlatter extends TileEntityBase {
  type: TileEntityType.FoodPlatter
  item: Item
}

export interface Pylon extends TileEntityBase {
  type: TileEntityType.Pylon
}

export interface DeadCellsDisplayJar extends TileEntityBase {
  type: TileEntityType.DeadCellsDisplayJar
  item: Item
}

export interface KiteAnchor extends TileEntityBase {
  type: TileEntityType.KiteAnchor
  itemId: number
}

export interface CritterAnchor extends TileEntityBase {
  type: TileEntityType.CritterAnchor
  itemId: number
}

export type TileEntity =
  | TrainingDummy
  | ItemFrame
  | LogicSensor
  | DisplayDoll
  | WeaponsRack
  | HatRack
  | FoodPlatter
  | Pylon
  | DeadCellsDisplayJar
  | KiteAnchor
  | CritterAnchor

export enum CreativePowerType {
  FreezeTime = 0,
  // StartDayImmediately,
  // StartNoonImmediately,
  // StartNightImmediately,
  // StartMidnightImmediately,
  // GodModePower,
  // ModifyWindDirectionAndStrength,
  // ModifyRainPower,
  ModifyTimeRate = 8,
  FreezeRainPower = 9,
  FreezeWindDirectionAndStrength = 10,
  // FarPlacementRangePower,
  DifficultySliderPower = 12,
  StopBiomeSpreadPower = 13,
  // SpawnRateSliderPerPlayerPower,
}
