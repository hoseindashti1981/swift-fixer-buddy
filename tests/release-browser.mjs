import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Same optional local browser harness as the phase 5/6 checks; no project dependency.
const { chromium } = await import(
  pathToFileURL(
    resolve(process.env.TEMP, "swift-fixer-browser-check/node_modules/playwright/index.mjs"),
  ).href
);
const root = resolve(".vercel/output/static");
const { default: app } = await import(
  pathToFileURL(resolve(".vercel/output/functions/__server.func/index.mjs")).href
);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (
      file.startsWith(root + "\\") &&
      (await stat(file)
        .then((s) => s.isFile())
        .catch(() => false))
    ) {
      res.setHeader(
        "Content-Type",
        {
          ".js": "application/javascript",
          ".html": "text/html",
          ".css": "text/css",
          ".json": "application/json",
          ".woff2": "font/woff2",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        }[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(await readFile(file));
      return;
    }
    const response = await app.fetch(new Request("http://localhost" + req.url), {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});
const report = {};
const errors = [];
const consoleErrors = [];
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
try {
  for (const query of [
    "q=%7B%22bad%22%3A1%7D&model=%5B1%5D",
    "q=%5B%22x%22%5D&brand=true",
    "category=%7B%7D&favorites=%5B1%5D&limit=-10",
  ]) {
    await page.goto(base + "/?" + query);
    await page.locator("#library-search").waitFor();
    assert.equal(await page.locator("#library-search").inputValue(), "");
    assert((await page.locator("#results ul > li").count()) > 0);
  }
  report.invalidSearchUrlsRenderSafely = true;
  await page.goto(base + "/note/ns-water-flow");
  await page.getByRole("button", { name: "ویرایش متن آفلاین", exact: true }).click();
  const body = page.getByLabel("متن آموزشی (Markdown)");
  await body.fill((await body.inputValue()) + "\nپیش‌نویس محفوظ فاز هشت");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "بازگشت به جستجو", exact: true }).click();
  assert((await body.inputValue()).includes("پیش‌نویس محفوظ فاز هشت"));
  assert(new URL(page.url()).pathname.includes("/note/"));
  const unload = page.waitForEvent("dialog");
  const reload = page.reload().catch(() => {});
  const dialog = await unload;
  assert.equal(dialog.type(), "beforeunload");
  await dialog.dismiss();
  await reload;
  assert((await body.inputValue()).includes("پیش‌نویس محفوظ فاز هشت"));
  await page.getByRole("button", { name: "ذخیره مطلب", exact: true }).click();
  await page.locator("form[data-note-editor]").waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "بازگشت به جستجو", exact: true }).click();
  await page.locator("#library-search").waitFor();
  report.unsavedNavigationAndReloadProtection = true;
  await page.goto(base + "/diagnose?guide=noise&v=2&answers=clear,knock,tap");
  await page.getByRole("button", { name: "ثبت خلاصه در یادداشت‌های من", exact: true }).click();
  await body.fill((await body.inputValue()) + "\nمشاهده تازه");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  assert((await body.inputValue()).includes("مشاهده تازه"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  await page.locator("form[data-note-editor]").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#guide-step").textContent(), "تقه با چه اتفاقی هم‌زمان است؟");
  report.guideBranchChangeProtectsEditedReport = true;
  assert.deepEqual(errors, []);
  report.pageErrors = errors;
  report.consoleErrors = consoleErrors;
  await mkdir("docs/phase-8-release", { recursive: true });
  await writeFile("docs/phase-8-release/browser.json", JSON.stringify(report, null, 2) + "\n");
  // The existing mobile suite now runs against production output too.
  const { spawn } = await import("node:child_process");
  const mobile = spawn(process.execPath, ["tests/mobile-ui.mjs"], {
    env: { ...process.env, APP_URL: base },
    stdio: "inherit",
    windowsHide: true,
  });
  const code = await new Promise((done) => mobile.on("exit", done));
  assert.equal(code, 0);
  console.log(report);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
