import CommonFormats from "@/converter-engine/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import type { TypstSnippet } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
import { BadMagicError, EOFError, InitializationError } from "@/converter-engine/errors.ts";

class TypstHandler implements FormatHandler {
  public name: string = "typst";
  public ready: boolean = false;

  public supportedFormats: FileFormat[] = [
    CommonFormats.TYPST.supported("typst", true, false, true),
    CommonFormats.PDF.supported("pdf", false, true),
    CommonFormats.SVG.supported("svg", false, true),
  ];

  private $typst?: TypstSnippet;

  async init() {
    const { $typst } = await import(
      "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs"
    );

    $typst.setCompilerInitOptions({
      getModule: () =>
        `${import.meta.env.BASE_URL}wasm/typst_ts_web_compiler_bg.wasm`,
    });
    $typst.setRendererInitOptions({
      getModule: () =>
        `${import.meta.env.BASE_URL}wasm/typst_ts_renderer_bg.wasm`,
    });

    this.$typst = $typst;
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    _inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (!this.ready || !this.$typst) throw new InitializationError("Handler not initialized.");

    const outputFiles: FileData[] = [];

    // When preceded by a handler that extracted embedded assets (e.g. DOCX→TYPST),
    // inputFiles contains the main .typ plus companion files. Compile one document
    // and mapShadow the assets so Typst can resolve #image(...) references.
    const mainIndex = inputFiles.findIndex((f) => f.name.endsWith(".typ"));
    const mainFile = mainIndex >= 0 ? inputFiles[mainIndex] : inputFiles[0];
    const mainPath = `/${mainFile.name}`;
    const mainContent = new TextDecoder().decode(mainFile.bytes);
    const baseName = mainFile.name.replace(/\.[^.]+$/u, "");

    await this.$typst.addSource(mainPath, mainContent);

    for (const file of inputFiles) {
      if (file === mainFile) continue;
      await this.$typst.mapShadow(`/${file.name}`, file.bytes);
    }

    if (outputFormat.internal === "pdf") {
      const pdfData = await this.$typst.pdf({ mainFilePath: mainPath });
      if (!pdfData) throw new Error("Typst compilation to PDF failed.");
      outputFiles.push({
        name: `${baseName}.pdf`,
        bytes: new Uint8Array(pdfData),
      });
    } else if (outputFormat.internal === "svg") {
      const svgString = await this.$typst.svg({ mainFilePath: mainPath });
      outputFiles.push({
        name: `${baseName}.svg`,
        bytes: new TextEncoder().encode(svgString),
      });
    }

    return outputFiles;
  }
}

export default TypstHandler;

