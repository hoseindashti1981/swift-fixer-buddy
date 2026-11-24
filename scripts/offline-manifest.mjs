import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve(".vercel/output/static");
const worker = await readFile(resolve(output, "sw.js"), "utf8");
const entries = [...worker.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]*")\}/g)].map((match) => ({
  url: match[1],
  revision: JSON.parse(match[2]),
}));
if (!entries.some((entry) => entry.url === "/_shell.html"))
  throw new Error("Missing offline shell");
if (!entries.some((entry) => entry.url.includes("offline-assets.json")))
  throw new Error("Offline manifest is not precached");
for (const entry of entries)
  await access(resolve(output, entry.url.replace(/^\//, ""))).catch((error) => {
    if (!entry.url.includes("offline-assets.json")) throw error;
  });
await writeFile(resolve(output, "offline-assets.json"), JSON.stringify({ version: 1, entries }));
console.log("Offline manifest: " + entries.length + " required assets.");
