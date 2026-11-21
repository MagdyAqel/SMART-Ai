import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // حزمة Firebase وحدها ~740KB
    rollupOptions: {
      output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"] } },
    },
  },
});
