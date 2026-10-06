import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = "http://localhost:8790";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: api,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/c/": { target: api },
      "/assets/cmp_": { target: api },
      "/evidence/": { target: api },
    },
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
