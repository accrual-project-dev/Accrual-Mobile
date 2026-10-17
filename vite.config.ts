import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globIgnores: [
          "**/xlsx-*.js",
          "**/pdf-*.js",
          "**/LuxuryReportExportSheet-*.js",
          "**/html2canvas-*.js",
          "**/jsqr-*.js",
          "**/tesseract-*.js",
          "**/tesseract.js*",
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],
      manifest: {
        name: "Accrual",
        short_name: "Accrual",
        description: "Personal expense and wealth tracker",
        theme_color: "#0A0A0B",
        background_color: "#0A0A0B",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        share_target: {
          action: "/",
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "Catat Pengeluaran",
            short_name: "Catat",
            description: "Buka form tambah transaksi langsung",
            url: "/?action=add",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Input Suara",
            short_name: "Suara",
            description: "Catat transaksi via suara",
            url: "/?action=voice",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Pindai Struk",
            short_name: "Pindai",
            description: "Scan struk atau bukti transfer",
            url: "/?action=scan",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/html2canvas")) return "html2canvas";
          if (id.includes("node_modules/jsqr")) return "jsqr";
          if (id.includes("node_modules/tesseract.js")) return "tesseract-vendor";
          if (
            id.includes("node_modules/@supabase") ||
            id.includes("node_modules/@tanstack")
          )
            return "query-supabase";
          if (id.includes("node_modules/date-fns")) return "date-vendor";
          if (id.includes("node_modules/lucide-react")) return "icons-vendor";
          if (
            id.includes("node_modules/@capacitor") ||
            id.includes("node_modules/@capgo")
          )
            return "capacitor-vendor";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ""),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    },
  },
});
