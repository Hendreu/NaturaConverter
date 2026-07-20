import { beforeEach, describe, expect, test } from "vitest";
import type { FileFormat, FormatHandler } from "@/converter-engine/FormatHandler";
import {
  clearStore,
  getDetectedFormat,
  getEditedBytes,
  getFile,
  getOutputFormat,
  setDetectedFormat,
  setEditedBytes,
  setFile,
  setOutputFormat,
} from "./file-store";

const fakeFormat: FileFormat = {
  name: "Test",
  format: "test",
  extension: "tst",
  mime: "application/x-test",
  internal: "test",
  from: true,
  to: true,
};

const fakeHandler: FormatHandler = {
  name: "test",
  ready: true,
  init: async () => {},
  doConvert: async () => [],
};

describe("file-store", () => {
  beforeEach(() => {
    clearStore();
  });

  test("setFile resets detectedFormat, editedBytes, and outputFormat", () => {
    const a = new File(["a"], "a.txt");
    const b = new File(["b"], "b.txt");
    const bytes = new Uint8Array([1, 2, 3]);

    setFile(a);
    setDetectedFormat({ format: fakeFormat, handler: fakeHandler });
    setEditedBytes(bytes);
    setOutputFormat(fakeFormat);

    setFile(b);

    expect(getFile()).toBe(b);
    expect(getDetectedFormat()).toBeNull();
    expect(getEditedBytes()).toBeNull();
    expect(getOutputFormat()).toBeNull();
  });
});
