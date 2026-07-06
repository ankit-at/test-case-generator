import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend lives in web/. API calls are proxied to the Express server.
export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
  },
});
