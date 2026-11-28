import { build } from "vite";
// Bundle server imports into plain JavaScript, independent of runtime TS support.
await build({
  configFile: false,
  publicDir: false,
  build: {
    ssr: "server/catalogueProxy.ts",
    outDir: "api",
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "catalogue.mjs", format: "es" },
    },
  },
});

await build({
  configFile: false,
  publicDir: false,
  build: {
    target: "node24",
    ssr: "server/assistant.ts",
    outDir: "api",
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "assistant.mjs", format: "es" },
    },
  },
});
