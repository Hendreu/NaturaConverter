import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import CommonFormats from "./CommonFormats";
import { ConvertPathNode, type FileData, type FormatHandler } from "./FormatHandler";

const { registerHandlers } = vi.hoisted(() => ({ registerHandlers: vi.fn() }));
vi.mock("@/converter-engine/handlers", () => ({ registerHandlers }));

beforeEach(() => {
  vi.resetModules();
  registerHandlers.mockReset();
  vi.stubGlobal("window", {});
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("engine initialization", () => {
  test("shares cold initialization across callers and publishes dynamically discovered outputs", async () => {
    let finishInitialization: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishInitialization = resolve; });
    let initializationCount = 0;
    let registrationCount = 0;
    const pdf = CommonFormats.PDF.supported("pdf", true, false);
    const text = CommonFormats.TEXT.supported("txt", false, true);
    const handler: FormatHandler = {
      name: "dynamic-pdf",
      ready: false,
      supportedFormats: [],
      async init() {
        initializationCount++;
        await pending;
        this.supportedFormats = [pdf, text];
        this.ready = true;
      },
      async doConvert(files: FileData[]) {
        return files.map((file) => ({ name: "converted.txt", bytes: new Uint8Array(file.bytes) }));
      },
    };
    registerHandlers.mockImplementation((handlers: FormatHandler[]) => {
      registrationCount++;
      handlers.push(handler);
    });
    const engine = await import("./engine");
    const first = engine.initEngine();
    await vi.waitFor(() => expect(initializationCount).toBeGreaterThan(0));
    const second = engine.initEngine();
    expect(engine.getOutputFormats(pdf)).toEqual([]);
    finishInitialization();
    await Promise.all([first, second]);
    expect(registrationCount).toBe(1);
    expect(initializationCount).toBe(1);
    expect(engine.detectFormat(new File([], "merged.pdf", { type: "application/pdf" })))
      .toEqual({ format: pdf, handler });
    expect(engine.getOutputFormats(pdf)).toEqual([text]);
    const source = new TextEncoder().encode("both merged pages");
    const before = source.slice();
    const result = await engine.convert(
      [{ name: "merged.pdf", bytes: source }],
      new ConvertPathNode(handler, pdf),
      new ConvertPathNode(handler, text),
    );
    expect(result?.files[0].bytes).toEqual(before);
    expect(source).toEqual(before);
    await engine.initEngine();
    expect(registrationCount).toBe(1);
  });

  test("allows retry after registration fails instead of caching a rejected initialization", async () => {
    const text = CommonFormats.TEXT.supported("txt", true, true);
    const handler: FormatHandler = {
      name: "text",
      ready: true,
      supportedFormats: [text],
      async init() {},
      async doConvert(files) { return files; },
    };
    registerHandlers.mockImplementationOnce(() => { throw new Error("registry unavailable"); });
    registerHandlers.mockImplementation((handlers: FormatHandler[]) => handlers.push(handler));
    const engine = await import("./engine");
    await expect(engine.initEngine()).rejects.toThrow("registry unavailable");
    await engine.initEngine();
    expect(engine.detectFormat(new File(["text"], "notes.txt", { type: "text/plain" })))
      .toEqual({ format: text, handler });
  });

  test("keeps working formats when an unrelated handler fails initialization", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pdf = CommonFormats.PDF.supported("pdf", true, false);
    const text = CommonFormats.TEXT.supported("txt", false, true);
    const working: FormatHandler = {
      name: "pdf-text",
      ready: true,
      supportedFormats: [pdf, text],
      async init() {},
      async doConvert(files) { return files; },
    };
    registerHandlers.mockImplementation((handlers: FormatHandler[]) => handlers.push({
      ...working,
      name: "broken",
      ready: false,
      async init() { throw new Error("unavailable WASM"); },
    }, working));
    try {
      const engine = await import("./engine");
      await engine.initEngine();
      expect(engine.getOutputFormats(pdf)).toEqual([text]);
      expect(engine.detectFormat(new File([], "merged.pdf"))?.handler).toBe(working);
    } finally {
      warn.mockRestore();
    }
  });
});
