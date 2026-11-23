import { describe, expect, test } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { applyEdits, mergePdfs } from "./pdf-edit";

async function makePdf(pages: { width: number; rotation: number }[]) {
  const document = await PDFDocument.create();
  for (const { width, rotation } of pages) {
    const page = document.addPage([width, 500]);
    page.setRotation(degrees(rotation));
    page.drawText(`Page ${width}`);
  }
  return new Uint8Array(await document.save()).buffer;
}

async function pageProperties(bytes: ArrayBuffer | Uint8Array) {
  const document = await PDFDocument.load(bytes);
  return document.getPages().map((page) => ({
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation().angle,
  }));
}

describe("PDF editing", () => {
  test("applies rotation deltas on top of source rotation while reordering and deleting", async () => {
    const source = await makePdf([
      { width: 200, rotation: 90 },
      { width: 300, rotation: 180 },
      { width: 400, rotation: 270 },
    ]);
    const before = source.slice(0);
    const result = await applyEdits(source, [
      { originalIndex: 2, rotation: 180 },
      { originalIndex: 0, rotation: 270 },
    ]);
    expect(await pageProperties(result)).toEqual([
      { width: 400, height: 500, rotation: 90 },
      { width: 200, height: 500, rotation: 0 },
    ]);
    expect(source).toEqual(before);
  });

  test("keeps original PDF bytes for a no-op edit", async () => {
    const source = await makePdf([{ width: 200, rotation: 90 }]);
    const result = await applyEdits(source, [{ originalIndex: 0, rotation: 0 }]);
    expect(result).toEqual(new Uint8Array(source));
  });

  test("merges all PDFs in selection order without changing page geometry or source bytes", async () => {
    const first = await makePdf([{ width: 200, rotation: 90 }]);
    const second = await makePdf([
      { width: 300, rotation: 180 },
      { width: 400, rotation: 270 },
    ]);
    const before = [first.slice(0), second.slice(0)];
    const result = await mergePdfs([first, second]);
    expect(await pageProperties(result)).toEqual([
      { width: 200, height: 500, rotation: 90 },
      { width: 300, height: 500, rotation: 180 },
      { width: 400, height: 500, rotation: 270 },
    ]);
    expect([first, second]).toEqual(before);
  });

  test("bakes edits before repeated appends and rebases subsequent edit indices", async () => {
    const source = await makePdf([
      { width: 200, rotation: 90 },
      { width: 300, rotation: 0 },
      { width: 400, rotation: 270 },
    ]);
    const addition = await makePdf([{ width: 600, rotation: 180 }]);
    const edited = await applyEdits(source, [
      { originalIndex: 2, rotation: 90 },
      { originalIndex: 0, rotation: 90 },
    ]);
    const merged = await mergePdfs([edited, addition]);
    const editedAgain = await applyEdits(new Uint8Array(merged).buffer, [
      { originalIndex: 2, rotation: 270 },
      { originalIndex: 0, rotation: 0 },
    ]);
    const appendedAgain = await mergePdfs([editedAgain, addition]);
    expect(await pageProperties(appendedAgain)).toEqual([
      { width: 600, height: 500, rotation: 90 },
      { width: 400, height: 500, rotation: 0 },
      { width: 600, height: 500, rotation: 180 },
    ]);
  });

  test("rejects an invalid appended PDF without changing the current bytes", async () => {
    const source = await makePdf([{ width: 200, rotation: 90 }]);
    const before = source.slice(0);
    await expect(mergePdfs([source, new TextEncoder().encode("not a PDF")])).rejects.toThrow();
    expect(source).toEqual(before);
    expect(await pageProperties(source)).toEqual([{ width: 200, height: 500, rotation: 90 }]);
  });

  test("does not insert a blank page when every existing page is deleted before append", async () => {
    const source = await makePdf([{ width: 200, rotation: 90 }]);
    const empty = await applyEdits(source, []);
    const addition = await makePdf([{ width: 300, rotation: 180 }]);
    const result = await mergePdfs([empty, addition]);
    expect(await pageProperties(result)).toEqual([{ width: 300, height: 500, rotation: 180 }]);
  });
});
