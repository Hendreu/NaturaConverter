declare module "./envelope/parseODF.js" {
  export function parseODT(bytes: Uint8Array): Promise<string>;
  export function parseODP(bytes: Uint8Array): Promise<string>;
  export function parseODS(bytes: Uint8Array): Promise<string>;
}

declare module "./envelope/parseDOCX.js" {
  export function parseDOCX(bytes: Uint8Array): Promise<string>;
}

declare module "./envelope/parsePPTX.js" {
  export function parsePPTX(bytes: Uint8Array): Promise<string>;
}

declare module "./envelope/parseXLSX.js" {
  export function parseXLSX(bytes: Uint8Array): Promise<string>;
}

declare module "./envelope/parseXML.js" {
  export function parseXML(text: string): unknown;
}

declare module "./pandoc/pandoc.js" {
  export function query(args: string[]): Promise<unknown>;
  export function convert(args: string[]): Promise<void>;
}

declare module "yaml" {
  export function parse(text: string): unknown;
  export function stringify(value: unknown): string;
}
