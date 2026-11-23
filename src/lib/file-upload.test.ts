import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { isPdfFile, prepareUpload } from "./file-upload";

describe("upload selection", () => {
  test("leaves a single non-PDF unchanged", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    expect(await prepareUpload([file])).toBe(file);
  });

  test("recognizes PDF MIME and case-insensitive PDF extensions", () => {
    expect(isPdfFile(new File([], "scan", { type: "application/pdf" }))).toBe(true);
    expect(isPdfFile(new File([], "scan.PDF"))).toBe(true);
    expect(isPdfFile(new File([], "scan.txt"))).toBe(false);
  });

  test("rejects mixed or multiple non-PDF selections instead of discarding files", async () => {
    const pdf = new File([], "scan.pdf");
    const text = new File(["text"], "notes.txt");
    await expect(prepareUpload([pdf, text])).rejects.toThrow("somente arquivos PDF");
    await expect(prepareUpload([text, text])).rejects.toThrow("somente arquivos PDF");
  });

  test("combines every PDF in selection order", async () => {
    const first = await PDFDocument.create();
    first.addPage([200, 500]);
    const second = await PDFDocument.create();
    second.addPage([300, 600]);
    const file = await prepareUpload([
      new File([new Uint8Array(await first.save())], "first.pdf"),
      new File([new Uint8Array(await second.save())], "second.PDF"),
    ]);
    expect(file.type).toBe("application/pdf");
    expect(file.name.endsWith(".pdf")).toBe(true);
    const result = await PDFDocument.load(await file.arrayBuffer());
    expect(result.getPages().map((page) => page.getSize())).toEqual([
      { width: 200, height: 500 },
      { width: 300, height: 600 },
    ]);
  });
});
