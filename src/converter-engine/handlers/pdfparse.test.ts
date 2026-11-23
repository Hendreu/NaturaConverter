import { describe, expect, test, vi } from "vitest";
import CommonFormats from "../CommonFormats";
import PdfParseHandler from "./pdfparse";

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    static setWorker() {}
    private data: Uint8Array;

    constructor({ data }: { data: Uint8Array<ArrayBuffer> }) {
      this.data = structuredClone(data, { transfer: [data.buffer] });
    }

    async getText() { return { text: new TextDecoder().decode(this.data) }; }
    async destroy() {}
  },
}));

describe("PDF text conversion buffer ownership", () => {
  test("does not transfer edited source bytes to the PDF worker", async () => {
    const handler = new PdfParseHandler();
    await handler.init();
    const bytes = new TextEncoder().encode("BETA SOURCE PAGE\nALPHA SOURCE PAGE");
    const before = bytes.slice();
    const result = await handler.doConvert(
      [{ name: "merged.pdf", bytes }],
      CommonFormats.PDF.supported("pdf", true, false),
      CommonFormats.TEXT.supported("txt", false, true),
    );
    expect(result[0].name).toBe("merged.txt");
    expect(result[0].bytes).toEqual(before);
    expect(bytes).toEqual(before);
  });

  test("can convert the same edited PDF concurrently and again without detaching it", async () => {
    const handler = new PdfParseHandler();
    await handler.init();
    const bytes = new TextEncoder().encode("both source pages");
    const before = bytes.slice();
    const convert = () => handler.doConvert(
      [{ name: "merged.pdf", bytes }],
      CommonFormats.PDF.supported("pdf", true, false),
      CommonFormats.TEXT.supported("txt", false, true),
    );
    const results = await Promise.all([convert(), convert()]);
    results.push(await convert());
    expect(results.map((files) => files[0].bytes)).toEqual([before, before, before]);
    expect(bytes).toEqual(before);
  });
});
