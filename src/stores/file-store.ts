import type { FileFormat, FormatHandler } from "@/converter-engine/FormatHandler";

let _file: File | null = null;
let _detectedFormat: { format: FileFormat; handler: FormatHandler } | null = null;
let _editedBytes: Uint8Array | null = null;
let _outputFormat: FileFormat | null = null;

export function setFile(file: File) {
  _file = file;
}

export function getFile() {
  return _file;
}

export function setDetectedFormat(
  detected: { format: FileFormat; handler: FormatHandler } | null,
) {
  _detectedFormat = detected;
}

export function getDetectedFormat() {
  return _detectedFormat;
}

export function setEditedBytes(bytes: Uint8Array | null) {
  _editedBytes = bytes;
}

export function getEditedBytes() {
  return _editedBytes;
}

export function setOutputFormat(format: FileFormat | null) {
  _outputFormat = format;
}

export function getOutputFormat() {
  return _outputFormat;
}

export function clearStore() {
  _file = null;
  _detectedFormat = null;
  _editedBytes = null;
  _outputFormat = null;
}
