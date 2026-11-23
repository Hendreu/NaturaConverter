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
  if (
    pages.length === src.getPageCount() &&
    pages.every((page, index) => page.originalIndex === index && page.rotation === 0)
  ) {
    return new Uint8Array(rawBytes.slice(0));
  }
  const out = await PDFDocument.create();

  const copied = await out.copyPages(
    src,
    pages.map((p) => p.originalIndex),
  );

  copied.forEach((page, i) => {
    const rotation = page.getRotation().angle + pages[i].rotation;
    page.setRotation(degrees(((rotation % 360) + 360) % 360));
    out.addPage(page);
  });

  return out.save({ addDefaultPage: false });
}

export async function mergePdfs(sources: (ArrayBuffer | Uint8Array)[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const bytes of sources) {
    const source = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save({ addDefaultPage: false });
}
