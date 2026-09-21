import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve(".vercel/output");
const config = JSON.parse(readFileSync(resolve(output, "config.json"), "utf8"));
assert.equal(config.version, 3);
assert(config.routes.some((route) => route.handle === "filesystem"));
assert(config.routes.some((route) => route.src === "/(.*)" && route.dest === "/__server"));
const functionDir = resolve(output, "functions/__server.func");
const runtime = JSON.parse(readFileSync(resolve(functionDir, ".vc-config.json"), "utf8"));
assert.match(runtime.runtime, /^nodejs\d+\.x$/);
assert.equal(runtime.supportsResponseStreaming, true);
assert(existsSync(resolve(output, "static/_shell.html")), "Missing offline SPA shell");
const worker = readFileSync(resolve(output, "static/sw.js"), "utf8");
assert(worker.includes("/_shell.html"), "Missing precached shell");
for (const [, url] of worker.matchAll(/\{url:"([^"]+)"/g)) {
  assert(
    existsSync(resolve(output, "static", url.replace(/^\//, ""))),
    `Missing precache asset: ${url}`,
  );
}
const { default: app } = await import(pathToFileURL(resolve(functionDir, runtime.handler)).href);
for (const path of ["/", "/ai", "/note/2-E02"]) {
  const response = await app.fetch(new Request(`http://localhost${path}`), {});
  assert.equal(response.status, 200, path);
  assert((await response.text()).includes("<html"), path);
}
const api = await app.fetch(
  new Request("http://localhost/api/ai-ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "" }),
  }),
  {},
);
assert.equal(api.status, 400, "API must reach server validation, not a static fallback");
await api.text();
console.log(
  "Vercel output verified: routing, Node function, SSR, API validation, PWA shell and cached assets.",
);
