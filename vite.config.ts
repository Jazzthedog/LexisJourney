import { defineConfig } from "vite";

// Relative base so the build works unmodified both zipped for itch.io
// (files served from an arbitrary folder) and hosted on GitHub Pages
// (served from a repo subpath).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
});
