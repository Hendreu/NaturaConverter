import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "@/converter-engine/FormatHandler";
import { TraversionGraph } from "@/converter-engine/TraversionGraph";
import normalizeMimeType from "@/converter-engine/normalizeMimeType";
import { InitializationError } from "@/converter-engine/errors";

let formatCache: Map<string, FileFormat[]> | null = null;
let graph: TraversionGraph | null = null;
let allOptions: Array<{ format: FileFormat; handler: FormatHandler }> = [];
let initialized = false;

export async function initEngine() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const { registerHandlers } = await import("@/converter-engine/handlers");
  const handlers: FormatHandler[] = [];
  registerHandlers(handlers);

  allOptions.length = 0;
  formatCache = new Map();

  for (const handler of handlers) {
    // Dynamic handlers (pandoc, ImageMagick, FFmpeg, etc.) populate
    // supportedFormats inside init(). Eager init is required so that every
    // supported conversion shows up as a format card on /format.
    try {
      if (!handler.ready) await handler.init();
    } catch (err) {
      console.warn(
        `Handler "${handler.name}" failed to initialize: ${(err as Error).message}`,
      );
      continue;
    }

    const supportedFormats = handler.supportedFormats;
    if (!supportedFormats) continue;
    formatCache.set(handler.name, supportedFormats);
    for (const format of supportedFormats) {
      if (!format.mime) continue;
      allOptions.push({ format, handler });
    }
  }

  graph = new TraversionGraph();
  graph.init(formatCache, handlers);
  initialized = true;
}

export function detectFormat(file: File): { format: FileFormat; handler: FormatHandler } | null {
  if (!initialized || !formatCache) return null;

  const mimeType = normalizeMimeType(file.type);
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  const buttonsMatchingMime = allOptions.filter((opt) => opt.format.mime === mimeType && opt.format.from);
  let matchedOption: { format: FileFormat; handler: FormatHandler } | null = null;

  if (buttonsMatchingMime.length > 1 && fileExtension) {
    matchedOption = buttonsMatchingMime.find(
      (opt) => opt.format.format.toLowerCase() === fileExtension,
    ) || buttonsMatchingMime[0];
  } else if (buttonsMatchingMime.length === 1) {
    matchedOption = buttonsMatchingMime[0];
  }

  if (!matchedOption && fileExtension) {
    matchedOption = allOptions.find(
      (opt) => opt.format.format.toLowerCase() === fileExtension && opt.format.from,
    ) || null;
  }

  return matchedOption;
}

export function getOutputFormats(inputFormat: FileFormat): FileFormat[] {
  if (!initialized) return [];

  const seenOutputs = new Set<string>();
  const outputOptions: FileFormat[] = [];

  for (const opt of allOptions) {
    if (!opt.format.to) continue;
    if (opt.format.mime === inputFormat.mime && opt.format.format === inputFormat.format) continue;
    const key = `${opt.format.mime}-${opt.format.format}`;
    if (seenOutputs.has(key)) continue;
    seenOutputs.add(key);
    outputOptions.push(opt.format);
  }

  return outputOptions;
}

let deadEndAttempts: ConvertPathNode[][] = [];

async function attemptConvertPath(files: FileData[], path: ConvertPathNode[]) {
  const pathString = path.map((c) => c.format.format).join(" → ");

  for (const deadEnd of deadEndAttempts) {
    let isDeadEnd = true;
    for (let i = 0; i < deadEnd.length; i++) {
      if (path[i] === deadEnd[i]) continue;
      isDeadEnd = false;
      break;
    }
    if (isDeadEnd) {
      const deadEndString = deadEnd.slice(-2).map((c) => c.format.format).join(" → ");
      console.warn(`Skipping ${pathString} due to dead end near ${deadEndString}.`);
      return null;
    }
  }

  for (let i = 0; i < path.length - 1; i++) {
    const handler = path[i + 1].handler;
    try {
      let supportedFormats = formatCache?.get(handler.name);
      if (!handler.ready) {
        await handler.init();
        if (!handler.ready) throw new InitializationError(`Handler "${handler.name}" not ready after init.`);
        if (handler.supportedFormats) {
          formatCache?.set(handler.name, handler.supportedFormats);
          supportedFormats = handler.supportedFormats;
        }
      }
      if (!supportedFormats) throw new TypeError(`Handler "${handler.name}" doesn't support any formats.`);
      const inputFormat = supportedFormats.find(
        (c) => c.from && c.mime === path[i].format.mime && c.format === path[i].format.format,
      ) || (handler.supportAnyInput ? path[i].format : undefined);
      if (!inputFormat) throw new TypeError(`Handler "${handler.name}" doesn't support "${path[i].format.format}".`);
      files = (await Promise.all([
        handler.doConvert(files, inputFormat, path[i + 1].format),
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ]))[0];
      if (files.some((c) => !c.bytes.length)) throw new RangeError("Output is empty.");
    } catch (e) {
      console.log(path.map((c) => c.format.format));
      console.error(handler.name, `${path[i].format.format} → ${path[i + 1].format.format}`, e);

      const deadEndPath = path.slice(0, i + 2);
      deadEndAttempts.push(deadEndPath);
      graph?.addDeadEndPath(path.slice(0, i + 2));

      return null;
    }
  }

  return { files, path };
}

export async function convert(
  files: FileData[],
  from: ConvertPathNode,
  to: ConvertPathNode,
): Promise<{ files: FileData[]; path: ConvertPathNode[] } | null> {
  if (!graph) return null;

  deadEndAttempts = [];
  graph.clearDeadEndPaths();

  for await (const path of graph.searchPath(from, to, true)) {
    if (path.at(-1)?.handler === to.handler) {
      path[path.length - 1] = to;
    }
    const attempt = await attemptConvertPath(files, path);
    if (attempt) return attempt;
  }
  return null;
}
