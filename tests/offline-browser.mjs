import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  pathToFileURL(
    resolve(process.env.TEMP, "swift-fixer-browser-check/node_modules/playwright/index.mjs"),
  ).href
);
const root = resolve(".vercel/output/static");
const { default: app } = await import(
  pathToFileURL(resolve(".vercel/output/functions/__server.func/index.mjs")).href
);
let mode = "normal";
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/update-missing.js") {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (
      file.startsWith(root + "\\") &&
      (await stat(file)
        .then((s) => s.isFile())
        .catch(() => false))
    ) {
      let body = await readFile(file);
      if (url.pathname === "/sw.js") {
        if (mode === "broken")
          body = Buffer.concat([Buffer.from("importScripts('/update-missing.js');\n"), body]);
        if (mode === "good")
          body = Buffer.concat([body, Buffer.from("\n// successful update fixture\n")]);
      }
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
      res.end(body);
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
const fixture = {
  id: "local-offline-fixture",
  title: "تجربه آفلاین",
  category: "تجربیات من",
  tags: ["آفلاین"],
  body: "متن پیش از آزمون",
};
const report = {};
try {
  let page = await context.newPage();
  await page.goto(base);
  await page.evaluate(
    (note) => localStorage.setItem("ai-saved-notes-v1", JSON.stringify([note])),
    fixture,
  );
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page
    .getByText("متن راهنما برای استفاده آفلاین آماده است", { exact: true })
    .waitFor({ timeout: 30000 });
  assert(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("repair-library-v2")).notes.some(
        (n) => n.id === "local-offline-fixture",
      ),
    ),
  );
  report.migration = true;
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  const roundTwo = JSON.parse(await readFile(resolve("docs/phase-9-round-2/batch.json"), "utf8"));
  for (const article of roundTwo.additions) {
    await page.goto(base + "/note/" + article.id + "#answer");
    await page.locator("#answer").waitFor();
    assert.equal((await page.locator("h1").textContent()).trim(), article.title);
  }
  report.roundTwoReviewedCardsAvailableOffline = roundTwo.additions.length;
  await page.goto(base + "/note/ns-co-alert#answer");
  await page.locator("#answer").waitFor();
  assert((await page.locator("h1").textContent()).includes("مونوکسیدکربن"));
  report.newReviewedContentAvailableOffline = true;
  await page.goto(base + "/note/ns-ir-temperature#answer");
  await page.locator("#answer").waitFor();
  assert((await page.locator("h1").textContent()).includes("دماسنج"));
  report.coldDirectRouteOffline = true;
  await page.goto(base + "/");
  await page.locator("#library-search").fill("دماسنج لیزری");
  await page.waitForTimeout(600);
  assert((await page.locator('#results a[href*="ns-ir-temperature"]').count()) > 0);
  report.offlineSearch = true;
  await page.goto(base + "/note/local-offline-fixture");
  await page.getByRole("button", { name: "ویرایش متن آفلاین", exact: true }).click();
  await page.getByLabel("متن آموزشی (Markdown)").fill("متن ویرایش‌شده بدون اینترنت");
  await page.getByRole("button", { name: "ذخیره مطلب", exact: true }).click();
  await page.getByRole("button", { name: "افزودن به علاقه‌مندی‌ها", exact: true }).click();
  await page.goto(base + "/");
  await page.locator("#library-search").fill("دماسنج لیزری");
  await page.locator("#library-search").press("Enter");
  await page.getByText("پشتیبان و داده‌های من", { exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "دریافت فایل پشتیبان", exact: true }).click();
  const download = await downloading;
  const backup = await readFile(await download.path(), "utf8");
  const parsed = JSON.parse(backup);
  assert.equal(parsed.notes[0].body, "متن ویرایش‌شده بدون اینترنت");
  assert(parsed.favorites.includes(fixture.id));
  assert(parsed.history.some((row) => row.query === "دماسنج لیزری"));
  await page.evaluate(() => {
    localStorage.removeItem("repair-library-v2");
    localStorage.removeItem("ai-saved-notes-v1");
    window.dispatchEvent(new Event("storage"));
  });
  const upload = () =>
    page.locator('input[type="file"]').setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await upload();
  await page.getByRole("button", { name: "اعمال بازیابی", exact: true }).click();
  await upload();
  await page.getByRole("button", { name: "اعمال بازیابی", exact: true }).click();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("repair-library-v2")).notes.length),
    1,
  );
  report.offlineEditFavoritesHistoryBackupRestore = true;
  await page.evaluate(() => {
    localStorage.setItem("repair-library-v2", "{damaged");
    window.dispatchEvent(new Event("storage"));
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await page.getByLabel("بازسازی کتابخانه از این فایل", { exact: false }).check();
  await page.getByRole("button", { name: "اعمال بازیابی", exact: true }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("repair-library-before-import-v2-raw")),
    "{damaged",
  );
  report.explicitDamagedDataRecovery = true;
  await context.setOffline(false);
  mode = "broken";
  const failedUpdate = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return await new Promise(async (done) => {
      const timer = setTimeout(() => done(false), 20000);
      registration.addEventListener(
        "updatefound",
        () => {
          const worker = registration.installing;
          worker.addEventListener("statechange", () => {
            if (worker.state === "redundant") {
              clearTimeout(timer);
              done(true);
            }
          });
        },
        { once: true },
      );
      try {
        await registration.update();
      } catch {
        clearTimeout(timer);
        done(true);
      }
    });
  });
  assert(failedUpdate, "Broken worker update did not fail");
  await context.setOffline(true);
  await page.goto(base + "/note/local-offline-fixture");
  await page.getByRole("heading", { name: fixture.title }).waitFor();
  assert((await page.locator("article").textContent()).includes("متن ویرایش‌شده بدون اینترنت"));
  report.failedUpdatePreservesOldOfflineApp = true;
  await context.setOffline(false);
  mode = "good";
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () =>
    Boolean((await navigator.serviceWorker.getRegistration()).waiting),
  );
  await page.getByRole("button", { name: "ویرایش متن آفلاین", exact: true }).click();
  await page.getByLabel("متن آموزشی (Markdown)").fill("پیش‌نویس ذخیره‌نشده");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "نصب نسخهٔ جدید و بازخوانی صفحه", exact: true }).click();
  assert.equal(await page.getByLabel("متن آموزشی (Markdown)").inputValue(), "پیش‌نویس ذخیره‌نشده");
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  report.updateDoesNotDiscardOpenEditor = true;
  await page.getByRole("button", { name: "نصب نسخهٔ جدید و بازخوانی صفحه", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("heading", { name: fixture.title }).waitFor();
  assert((await page.locator("article").textContent()).includes("متن ویرایش‌شده بدون اینترنت"));
  report.successfulUpdatePreservesPersonalData = true;
  const removed = await page.evaluate(async () => {
    const manifest = await (await fetch("/offline-assets.json")).json();
    const entry = manifest.entries.find((entry) => entry.url.endsWith(".png"));
    const url = new URL(entry.url, location.origin);
    if (entry.revision !== null) url.searchParams.set("__WB_REVISION__", entry.revision);
    let removed = false;
    for (const key of await caches.keys())
      removed = (await (await caches.open(key)).delete(url.href)) || removed;
    window.dispatchEvent(new Event("online"));
    return removed;
  });
  assert(removed);
  await page.getByText("آمادگی آفلاین هنوز تأیید نشده است", { exact: true }).waitFor();
  report.missingRequiredAssetRevokesReady = true;
  await mkdir("docs/phase-6-offline", { recursive: true });
  await page.screenshot({ path: "docs/phase-6-offline/status.png", fullPage: true });
  await writeFile("docs/phase-6-offline/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
