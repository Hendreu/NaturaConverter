export type PageEditState = {
  originalIndex: number;
  rotation: 0 | 90 | 180 | 270;
};

export async function applyEdits(
  rawBytes: ArrayBuffer,
  pages: PageEditState[],
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const src = await PDFDocument.load(rawBytes);
  const out = await PDFDocument.create();

  const copied = await out.copyPages(
    src,
    pages.map((p) => p.originalIndex),
  );

  copied.forEach((page, i) => {
    page.setRotation(degrees(pages[i].rotation));
    out.addPage(page);
  });

  return out.save();
}
