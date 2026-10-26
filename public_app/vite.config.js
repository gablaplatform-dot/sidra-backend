import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Open the connection to the API (DNS + TLS, ~0.5 s from Uganda) while the page is still loading its scripts.
  let apiOrigin = "";
  try {
    apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : "";
  } catch {
    apiOrigin = "";
  }
  return {
    plugins: [
      react(),
      {
        name: "preconnect-api",
        transformIndexHtml: (html) => (apiOrigin ? html.replace("</head>", `    <link rel="preconnect" href="${apiOrigin}" crossorigin />\n  </head>`) : html)
      }
    ],
    build: {
      rollupOptions: {
        output: {
          // Libraries change rarely: keep them in their own files so a new release doesn't make everyone download them again.
          manualChunks: (id) => {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
            if (/node_modules\/(i18next|react-i18next|i18next-browser-languagedetector)\//.test(id)) return "vendor-i18n";
            return undefined;
          }
        }
      }
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true
        }
      }
    }
  };
});
