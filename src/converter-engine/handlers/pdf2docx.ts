import CommonFormats from "@/converter-engine/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class pdf2docxHandler implements FormatHandler {
  public name = "pdf2docx";

  public supportedFormats: FileFormat[] = [
    CommonFormats.PDF.builder("pdf").allowFrom(),
    CommonFormats.DOCX.supported("docx", false, true),
  ];

  public ready = true;

  // ponytail: pyodide is ~50 MB, so load the converter only on first use
  private converter: { convert: (pdf: Blob, pages?: number[]) => Promise<Blob> } | null = null;

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (outputFormat.format !== "docx") {
      throw new TypeError(`Unsupported output format: ${outputFormat.internal}`);
    }

    if (!this.converter) {
      const { Pdf2Docx } = await import("pdf2docx-wasm");
      this.converter = new Pdf2Docx("/wasm/pdf2docx/");
    }

    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      const blob = new Blob([new Uint8Array(inputFile.bytes)], { type: inputFormat.mime });
      const docxBlob = await this.converter.convert(blob);
      const bytes = new Uint8Array(await docxBlob.arrayBuffer());
      const baseName = inputFile.name.replace(/\.[^.]+$/, "");
      outputFiles.push({ bytes, name: `${baseName}.docx` });
    }

    return outputFiles;
  }
}

export default pdf2docxHandler;
