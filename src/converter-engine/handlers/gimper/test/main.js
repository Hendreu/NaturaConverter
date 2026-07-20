import XCF from "../src/main.js";
import { readFileSync, writeFileSync } from "node:fs";

const bytes = readFileSync(process.argv[2] || "test/samples/simple.xcf");

const xcf = await XCF.from_bytes(bytes);
const pixel_data = await xcf.getLayerPixels(0);
writeFileSync("test/output.json", JSON.stringify(pixel_data));