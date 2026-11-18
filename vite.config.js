import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/elections-2026/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/") || id.includes("/node_modules/victory-vendor/")) {
            return "charts";
          }
          if (id.includes("/node_modules/leaflet/") || id.includes("/node_modules/react-leaflet/")) {
            return "maps";
          }
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
