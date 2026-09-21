import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadOptions } from "nitro/builder";
import type { Nitro } from "nitro/types";
import type {} from "nitro/vite";

export default defineLovableConfig({
  tanstackStart: {
    spa: { enabled: true },
    server: { entry: "server" },
  },

  nitro: { preset: "vercel" },

  vite: {
    plugins: [
      {
        name: "preserve-vercel-output-hook",
        nitro: {
          async setup(nitro: Nitro) {
            if (nitro.options.preset !== "vercel") return;
            // Lovable 2.20.0 replaces the preset's compiled hook when enabling SPA prerendering.
            const { hooks } = await loadOptions({ preset: "vercel" });
            if (hooks.compiled) nitro.hooks.hook("compiled", hooks.compiled);
          },
        },
      },
      VitePWA({
        integration: {
          configureOptions(config, options) {
            options.outDir = config.environments["client"]?.build.outDir ?? config.build.outDir;
          },
        },

        strategies: "generateSW",
        registerType: "prompt",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,

        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,woff2,webmanifest}"],
          globIgnores: ["**/_shell.html"],

          additionalManifestEntries: [
            {
              url: "/_shell.html",
              revision: new Date().toISOString(),
            },
          ],

          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: "/_shell.html",

          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],

          cleanupOutdatedCaches: true,
          clientsClaim: true,

          importScripts: ["/notification-sw.js"],

          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && ["script", "style", "font", "image"].includes(request.destination),

              handler: "CacheFirst",

              options: {
                cacheName: "assets",

                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 60,
                },
              },
            },
          ],
        },
      }),
    ],
  },
});
