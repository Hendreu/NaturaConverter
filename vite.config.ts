// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*",
            dest: "wasm",
          },
          {
            src: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm",
            dest: "wasm",
          },
          {
            src: "src/converter-engine/handlers/pandoc/pandoc.wasm",
            dest: "wasm",
          },
          {
            src: "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs",
            dest: "js",
          },
          {
            src: "node_modules/7z-wasm/7zz.wasm",
            dest: "wasm",
          },
          {
            src: "node_modules/@flo-audio/reflo/reflo_bg.wasm",
            dest: "wasm",
          },
          {
            src: "src/converter-engine/handlers/libopenmpt/libopenmpt.wasm",
            dest: "wasm",
          },
          {
            src: "src/converter-engine/handlers/libopenmpt/libopenmpt.js",
            dest: "wasm",
          },
          {
            src: "node_modules/js-synthesizer/externals/libfluidsynth-2.4.6.js",
            dest: "wasm",
          },
          {
            src: "node_modules/js-synthesizer/dist/js-synthesizer.js",
            dest: "wasm",
          },
          {
            src: "src/converter-engine/handlers/midi/TimGM6mb.sf2",
            dest: "wasm",
          },
          {
            src: "src/converter-engine/handlers/espeakng.js/js/espeakng.worker.js",
            dest: "js",
          },
          {
            src: "src/converter-engine/handlers/espeakng.js/js/espeakng.worker.data",
            dest: "js",
          },
          {
            src: "node_modules/turbowarp-packager-browser/dist/scaffolding/*",
            dest: "js/turbowarp-scaffolding",
          },
          {
            src: "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
            dest: "wasm",
          },
          {
            src: "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
            dest: "wasm",
          },
        ],
      }),
    ],
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@imagemagick/magick-wasm", "7z-wasm", "@sqlite.org/sqlite-wasm", "@bokuweb/zstd-wasm", "@yowasp/clang"],
    },

    build: {
      commonjsOptions: {
        ignore: ["canvas"],
      },
      rolldownOptions: {
        external: ["canvas"],
      },
    },
  },
});
