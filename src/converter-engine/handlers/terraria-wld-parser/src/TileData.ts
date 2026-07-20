// @ts-ignore
import { Liquid, Slope, Tile, TileFlag } from './types'

export class TileData {
  readonly width: number
  readonly height: number
  readonly count: number

  blockId: Uint16Array
  frameX: Int16Array
  frameY: Int16Array
  blockColor: Uint8Array
  wallId: Uint16Array
  wallColor: Uint8Array
  liquidAmount: Uint8Array
  liquidType: Uint8Array
  flags: Uint16Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.count = width * height

    this.blockId = new Uint16Array(this.count)
    this.frameX = new Int16Array(this.count)
    this.frameY = new Int16Array(this.count)
    this.blockColor = new Uint8Array(this.count)
    this.wallId = new Uint16Array(this.count)
    this.wallColor = new Uint8Array(this.count)
    this.liquidAmount = new Uint8Array(this.count)
    this.liquidType = new Uint8Array(this.count)
    this.flags = new Uint16Array(this.count)
  }

  index(x: number, y: number): number {
    return x * this.height + y
  }

  hasBlock(i: number): boolean {
    return (this.flags[i] & TileFlag.IS_BLOCK_ACTIVE) !== 0
  }

  getSlope(i: number): number {
    return (this.flags[i] & TileFlag.SLOPE_MASK) >> TileFlag.SLOPE_SHIFT
  }

  setSlope(i: number, slope: number): void {
    this.flags[i] = (this.flags[i] & ~TileFlag.SLOPE_MASK) | (slope << TileFlag.SLOPE_SHIFT)
  }

  getTile(x: number, y: number): Tile {
    const i = this.index(x, y)
    const f = this.flags[i]
    const tile: Tile = {}

    if (f & TileFlag.IS_BLOCK_ACTIVE) {
      tile.blockId = this.blockId[i]

      if (this.frameX[i] !== 0) tile.frameX = this.frameX[i]
      if (this.frameY[i] !== 0) tile.frameY = this.frameY[i]
      if (this.blockColor[i] !== 0) tile.blockColor = this.blockColor[i]

      const slope = (f & TileFlag.SLOPE_MASK) >> TileFlag.SLOPE_SHIFT
      if (slope) tile.slope = slope as Slope

      if (f & TileFlag.ACTUATOR) tile.actuator = true
      if (f & TileFlag.ACTUATED) tile.actuated = true
      if (f & TileFlag.INVISIBLE_BLOCK) tile.invisibleBlock = true
      if (f & TileFlag.FULL_BRIGHT_BLOCK) tile.fullBrightBlock = true
    }

    if (this.wallId[i] !== 0) {
      tile.wallId = this.wallId[i]
      if (this.wallColor[i] !== 0) tile.wallColor = this.wallColor[i]
      if (f & TileFlag.INVISIBLE_WALL) tile.invisibleWall = true
      if (f & TileFlag.FULL_BRIGHT_WALL) tile.fullBrightWall = true
    }

    if (this.liquidAmount[i] !== 0) {
      tile.liquidAmount = this.liquidAmount[i]
      tile.liquidType = this.liquidType[i] as Liquid
    }

    if (f & TileFlag.WIRE_RED) tile.wireRed = true
    if (f & TileFlag.WIRE_BLUE) tile.wireBlue = true
    if (f & TileFlag.WIRE_GREEN) tile.wireGreen = true
    if (f & TileFlag.WIRE_YELLOW) tile.wireYellow = true

    return tile
  }

  setTile(x: number, y: number, tile: Tile): void {
    const i = this.index(x, y)
    let f = 0

    if (tile.blockId !== undefined) {
      f |= TileFlag.IS_BLOCK_ACTIVE
      this.blockId[i] = tile.blockId
      this.frameX[i] = tile.frameX ?? 0
      this.frameY[i] = tile.frameY ?? 0
      this.blockColor[i] = tile.blockColor ?? 0

      if (tile.slope) f |= (tile.slope << TileFlag.SLOPE_SHIFT)
      if (tile.actuator) f |= TileFlag.ACTUATOR
      if (tile.actuated) f |= TileFlag.ACTUATED
      if (tile.invisibleBlock) f |= TileFlag.INVISIBLE_BLOCK
      if (tile.fullBrightBlock) f |= TileFlag.FULL_BRIGHT_BLOCK
    } else {
      this.blockId[i] = 0
      this.frameX[i] = 0
      this.frameY[i] = 0
      this.blockColor[i] = 0
    }

    this.wallId[i] = tile.wallId ?? 0
    this.wallColor[i] = tile.wallColor ?? 0
    if (tile.invisibleWall) f |= TileFlag.INVISIBLE_WALL
    if (tile.fullBrightWall) f |= TileFlag.FULL_BRIGHT_WALL

    this.liquidAmount[i] = tile.liquidAmount ?? 0
    this.liquidType[i] = tile.liquidType ?? 0

    if (tile.wireRed) f |= TileFlag.WIRE_RED
    if (tile.wireBlue) f |= TileFlag.WIRE_BLUE
    if (tile.wireGreen) f |= TileFlag.WIRE_GREEN
    if (tile.wireYellow) f |= TileFlag.WIRE_YELLOW

    this.flags[i] = f
  }

  copyTile(srcIdx: number, dstIdx: number): void {
    this.blockId[dstIdx] = this.blockId[srcIdx]
    this.frameX[dstIdx] = this.frameX[srcIdx]
    this.frameY[dstIdx] = this.frameY[srcIdx]
    this.blockColor[dstIdx] = this.blockColor[srcIdx]
    this.wallId[dstIdx] = this.wallId[srcIdx]
    this.wallColor[dstIdx] = this.wallColor[srcIdx]
    this.liquidAmount[dstIdx] = this.liquidAmount[srcIdx]
    this.liquidType[dstIdx] = this.liquidType[srcIdx]
    this.flags[dstIdx] = this.flags[srcIdx]
  }

  tilesEqual(a: number, b: number): boolean {
    return (
      this.blockId[a] === this.blockId[b] &&
      this.frameX[a] === this.frameX[b] &&
      this.frameY[a] === this.frameY[b] &&
      this.blockColor[a] === this.blockColor[b] &&
      this.wallId[a] === this.wallId[b] &&
      this.wallColor[a] === this.wallColor[b] &&
      this.liquidAmount[a] === this.liquidAmount[b] &&
      this.liquidType[a] === this.liquidType[b] &&
      this.flags[a] === this.flags[b]
    )
  }
}
