import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

export type ThumbnailPage = {
  id: number;
  dataUrl: string;
  width: number;
  height: number;
};

let workerReady = false;

function ensurePdfWorker() {
  if (workerReady) return;
  if (typeof window === "undefined") return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  workerReady = true;
}

export async function renderPdfThumbnails(bytes: ArrayBuffer): Promise<ThumbnailPage[]> {
  ensurePdfWorker();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const thumbnails: ThumbnailPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      page.cleanup();
      throw new RenderError(`Failed to get 2D context for page ${i}`);
    }

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
