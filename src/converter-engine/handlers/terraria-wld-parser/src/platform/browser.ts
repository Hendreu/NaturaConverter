export async function fileLoader(file: Blob): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}
