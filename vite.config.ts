import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
    }),
  ],
  assetsInclude: ['**/*.svg'],
  css: {
    postcss: './postcss.config.js',
  },
});
