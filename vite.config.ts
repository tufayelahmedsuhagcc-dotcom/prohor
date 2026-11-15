import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", allowedHosts: true },
  build: {
    outDir: "web",
    target: "es2022",
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        /*
         * Stable vendor chunks. A file whose content did not change keeps its
         * hash, so a deploy that only touches app code no longer invalidates the
         * React runtime in every visitor's cache. papaparse lives on its own
         * because only the CSV paths import it.
         */
        manualChunks: (id: string) => {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
          if (id.includes("node_modules/zod/")) return "zod";
          if (id.includes("node_modules/papaparse/")) return "papa";
          if (id.includes("node_modules/lucide-react/")) return "icons";
          return undefined;
        },
      },
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
