import { mergePdfs } from "./pdf-edit";

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function prepareUpload(files: File[]): Promise<File> {
  if (files.length === 1) return files[0];
  if (!files.every(isPdfFile)) {
    throw new Error("Para selecionar vários arquivos, escolha somente arquivos PDF.");
  }
  const bytes = await mergePdfs(await Promise.all(files.map((file) => file.arrayBuffer())));
  return new File(
    [new Uint8Array(bytes)],
    `${files[0].name.replace(/\.pdf$/i, "")}-combinado.pdf`,
    {
      type: "application/pdf",
    },
  );
}
