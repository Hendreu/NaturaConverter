[**terraria-world-file**](../README.md)

***

[terraria-world-file](../globals.md) / FileReader

# Class: FileReader

Defined in: [FileReader.ts:27](https://github.com/cokolele/terraria-world-file-ts/blob/f9c03bfd42a2460ea023189ad9137d558debc939/src/FileReader.ts#L27)

## Constructors

### Constructor

> **new FileReader**(): `FileReader`

#### Returns

`FileReader`

## Methods

### loadBuffer()

> **loadBuffer**(`buffer`): `Promise`\<`FileReader`\>

Defined in: [FileReader.ts:55](https://github.com/cokolele/terraria-world-file-ts/blob/f9c03bfd42a2460ea023189ad9137d558debc939/src/FileReader.ts#L55)

#### Parameters

##### buffer

`ArrayBuffer`

#### Returns

`Promise`\<`FileReader`\>

***

### loadFile()

#### Call Signature

> **loadFile**(`loader`, `file`): `Promise`\<`FileReader`\>

Defined in: [FileReader.ts:49](https://github.com/cokolele/terraria-world-file-ts/blob/f9c03bfd42a2460ea023189ad9137d558debc939/src/FileReader.ts#L49)

##### Parameters

###### loader

(`file`) => `Promise`\<`ArrayBuffer`\>

###### file

`File` | `Blob`

##### Returns

`Promise`\<`FileReader`\>

#### Call Signature

> **loadFile**(`loader`, `file`): `Promise`\<`FileReader`\>

Defined in: [FileReader.ts:50](https://github.com/cokolele/terraria-world-file-ts/blob/f9c03bfd42a2460ea023189ad9137d558debc939/src/FileReader.ts#L50)

##### Parameters

###### loader

(`path`) => `Promise`\<`ArrayBuffer`\>

###### file

`string`

##### Returns

`Promise`\<`FileReader`\>

***

### parse()

> **parse**\<`T`\>(`options?`): [`WorldSections`](../type-aliases/WorldSections.md)\<`T`\>

Defined in: [FileReader.ts:61](https://github.com/cokolele/terraria-world-file-ts/blob/f9c03bfd42a2460ea023189ad9137d558debc939/src/FileReader.ts#L61)

#### Type Parameters

##### T

`T` *extends* (`"footer"` \| `"fileFormatHeader"` \| `"header"` \| `"worldTiles"` \| `"chests"` \| `"signs"` \| `"NPCs"` \| `"tileEntities"` \| `"weightedPressurePlates"` \| `"townManager"` \| `"bestiary"` \| `"creativePowers"`)[]

#### Parameters

##### options?

`Options`\<`T`\>

#### Returns

[`WorldSections`](../type-aliases/WorldSections.md)\<`T`\>
