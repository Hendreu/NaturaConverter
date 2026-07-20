import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ThumbnailPage = {
  id: number;
  dataUrl: string;
  width: number;
  height: number;
};

export async function renderPdfThumbnails(bytes: ArrayBuffer): Promise<ThumbnailPage[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const thumbnails: ThumbnailPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;

    thumbnails.push({
      id: i,
      dataUrl: canvas.toDataURL("image/jpeg", 0.6),
      width: viewport.width,
      height: viewport.height,
    });

    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }

  return thumbnails;
}
