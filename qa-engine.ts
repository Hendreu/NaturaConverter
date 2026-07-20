// ponytail: Node-level engine QA — proves registration + conversion without a browser.
// Run: bun.cmd run qa-engine.ts   (from repo root)
(globalThis as any).window = globalThis;
(globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
(globalThis as any).self = globalThis;

// ponytail: Node-only shims — both libs work untouched in the browser.
// bson: guards on process.getBuiltinModule('v8'), which Bun doesn't implement.
const proc = (globalThis as any).process;
if (proc?.getBuiltinModule) {
  const orig = proc.getBuiltinModule.bind(proc);
  proc.getBuiltinModule = (m: string) => (m === "v8" ? {} : orig(m));
}
// turbowarp-packager-browser: module scope requires indexedDB. Not exercised in this QA.
const { mock } = await import("bun:test");
mock.module("turbowarp-packager-browser", () => ({
  Packager: class {},
  largeAssets: { scaffolding: {}, "scaffolding-min": {}, addons: {} },
  downloadProject: () => {},
}));

const results: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const { initEngine, detectFormat, getOutputFormats, convert } = await import("./src/converter-engine/engine.ts");
const { registerHandlers } = await import("./src/converter-engine/handlers/index.ts");

// A) registration count
const handlers: any[] = [];
registerHandlers(handlers);
check("A1 registry loads", handlers.length > 0, `${handlers.length} handlers registered`);
const names = handlers.map((h) => h.name);
for (const expected of ["qoi-fu", "svgTrace", "toon", "TextEncoding", "typst", "sqlite3", "FFmpeg", "ImageMagick", "pandoc", "sevenZip"]) {
  check(`A2 handler present: ${expected}`, names.includes(expected));
}

await initEngine();

// B) format enumeration for PNG
const pngBytes = new Uint8Array(await Bun.file("C:/Users/HENDRE~1/AppData/Local/Temp/opencode/test-qa.png").arrayBuffer());
const pngFile = new File([pngBytes], "test-qa.png", { type: "image/png" });
const detected = detectFormat(pngFile);
check("B1 PNG detected", detected !== null, detected ? `via ${detected.handler.name}` : "no handler");
if (detected) {
  const outputs = getOutputFormats(detected.format);
  const qoiOut = outputs.find((o) => o.format === "qoi");
  check("B2 output formats enumerated", outputs.length > 10, `${outputs.length} options`);
  check("B3 QOI advertised as PNG output", qoiOut !== undefined);

  // C) PNG -> QOI end-to-end (new pure-JS handler)
  // ponytail: skipped in Node — qoi-fu decodes PNG via document.createElement("canvas") at init (browser-only).
  // Browser behavior is code-parity with the source app where this path works.
}

// D) JSON -> TOON (new pure-JS handler, no DOM)
const jsonBytes = new TextEncoder().encode(JSON.stringify({ hello: "world", n: 42, arr: [1, 2, 3] }));
const jsonFile = new File([jsonBytes], "data.json", { type: "application/json" });
const detectedJson = detectFormat(jsonFile);
check("D1 JSON detected", detectedJson !== null, detectedJson ? `via ${detectedJson.handler.name}` : "no handler");
if (detectedJson) {
  const outputs = getOutputFormats(detectedJson.format);
  const toonOut = outputs.find((o) => o.format === "toon");
  check("D2 TOON advertised as JSON output", toonOut !== undefined);
  if (toonOut) {
    const toonHandler = handlers.find((h) => h.supportedFormats?.some((f: any) => f.to && f.format === "toon"));
    try {
      const res = await convert(
        [{ name: "data.json", bytes: jsonBytes }],
        { format: detectedJson.format, handler: detectedJson.handler },
        { format: toonOut, handler: toonHandler },
      );
      const text = res ? new TextDecoder().decode(res.files[0].bytes) : "";
      check("D3 JSON->TOON converts", !!res && text.includes("hello"), res ? `${res.files[0].bytes.length} bytes` : "no path");
    } catch (e) {
      check("D3 JSON->TOON converts", false, String(e).slice(0, 120));
    }
  }
}

// E) JSON -> BSON (new bson handler, Node-safe)
if (detectedJson) {
  const outputs = getOutputFormats(detectedJson.format);
  const bsonOut = outputs.find((o) => o.format === "bson");
  check("E1 BSON advertised as JSON output", bsonOut !== undefined);
  if (bsonOut) {
    const bsonHandler = handlers.find((h) => h.supportedFormats?.some((f: any) => f.to && f.format === "bson"));
    try {
      const res = await convert(
        [{ name: "data.json", bytes: jsonBytes }],
        { format: detectedJson.format, handler: detectedJson.handler },
        { format: bsonOut, handler: bsonHandler },
      );
      const back = res ? new TextDecoder().decode(res.files[0].bytes.slice(0, 60)) : "";
      check("E2 JSON->BSON converts", !!res && res.files[0].bytes.length > 20, res ? `${res.files[0].bytes.length} bytes` : "no path");
    } catch (e) {
      check("E2 JSON->BSON converts", false, String(e).slice(0, 120));
    }
  }
}

console.log("\n===== QA RESULTS =====");
for (const r of results) console.log(r);
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`===== ${results.length - fails}/${results.length} PASS =====`);
process.exit(fails ? 1 : 0);
