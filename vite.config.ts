import { defineConfig as defineViteConfig } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineViteConfig(async (env) => {
  const config = await defineLovableConfig({
    tanstackStart: {
      spa: { enabled: true },
      server: { entry: "server" },
    },

    nitro: false,

    vite: {
      plugins: [
        VitePWA({
          integration: {
            configureOptions(config, options) {
              options.outDir =
                config.environments["client"]?.build.outDir ??
                config.build.outDir;
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

            navigateFallbackDenylist: [
              /^\/~oauth/,
              /^\/api\//,
            ],

            cleanupOutdatedCaches: true,
            clientsClaim: true,

            importScripts: ["/notification-sw.js"],

            runtimeCaching: [
              {
                urlPattern: ({ request, sameOrigin }) =>
                  sameOrigin &&
                  ["script", "style", "font", "image"].includes(
                    request.destination,
                  ),

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
  })(env);

  // فقط هنگام build، Nitro مخصوص Vercel را اضافه می‌کنیم.
  if (env.command === "build") {
    config.plugins = [
      ...(config.plugins ?? []),

      nitro({
        preset: "vercel",

        output: {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        },
      }),
    ];
  }

  return config;
});