import { build } from "vite";
await build({
  configFile: false,
  publicDir: false,
  build: {
    target: "node24",
    ssr: "src/mcp/stdio.ts",
    outDir: "mcp-dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: [
        "@modelcontextprotocol/server",
        "@modelcontextprotocol/server/stdio",
        "zod",
      ],
      output: { entryFileNames: "careerradar.mjs", format: "es" },
    },
  },
});
