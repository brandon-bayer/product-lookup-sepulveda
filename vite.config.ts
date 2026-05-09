import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockProducts = [
  { sku: "SEP-10042", styleName: "COASTAL BREEZE", styleNumber: "Monterey Plank", colorName: "DRIFTWOOD", colorNumber: "Sand Dollar", manufacturer: "Shaw Industries (SHW)", cost: "2.89", price: "5.49", width: "12ft / 48 ct", backing: "2024-03" },
  { sku: "SEP-10078", styleName: "HIGHLAND RIDGE", styleNumber: "Summit Oak", colorName: "AUTUMN EMBER", colorNumber: "Chestnut", manufacturer: "Mohawk Group (MOH)", cost: "3.45", price: "6.99", width: "15ft / 36 ct", backing: "2024-01" },
  { sku: "SEP-10115", styleName: "URBAN CANVAS", styleNumber: "Metro Tile", colorName: "GRAPHITE MIST", colorNumber: "Slate Gray", manufacturer: "Armstrong Flooring (ARM)", cost: "1.75", price: "3.29", width: "6ft / 60 ct", backing: "2023-11" },
  { sku: "SEP-10203", styleName: "RIVIERA SAND", styleNumber: "Coastal Oak", colorName: "BLEACHED LINEN", colorNumber: "Natural Wheat", manufacturer: "Shaw Industries (SHW)", cost: "4.10", price: "7.80", width: "12ft / 24 ct", backing: "2024-04" },
];

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    themePlugin(),
    {
      name: "mock-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          const json = (data: unknown) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };
          if (url === "/api/user") return json({ id: 1, username: "brandon", displayName: "Brandon Bayer" });
          if (url.startsWith("/api/products")) return json(mockProducts);
          if (url === "/api/scans") return json([]);
          if (url === "/api/data-files") return json([]);
          next();
        });
      },
    },
  ],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
