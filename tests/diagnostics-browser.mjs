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
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
const output = resolve(process.env.DIAGNOSTICS_OUTPUT ?? "docs/phase-7-diagnostics");
await mkdir(output, { recursive: true });
try {
  let page = await context.newPage();
  await page.goto(base + "/?q=تقه&model=L24FF");
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.getByText("متن راهنما برای استفاده آفلاین آماده است", { exact: true }).waitFor();
  // No diagnostic route has been opened online: its chunks must already be precached.
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  await page.goto(base + "/diagnose?guide=noise&v=2&answers=clear,knock,tap&model=L24FF&q=تقه");
  const heading = () => page.locator("#guide-step");
  const click = (name) => page.getByRole("button", { name, exact: true }).click();
  assert.equal(await heading().textContent(), "ضربه قوچ قابل بررسی است");
  await page.getByText("مبنای این مرحله و منابع", { exact: true }).click();
  assert(await page.getByText("Expansion; water hammering", { exact: true }).isVisible());
  assert((await page.getByText(/دستگاه ثبت‌شده:/).textContent()).includes("L24FF"));
  report.coldOfflineRouteWithSourcesAndModel = true;

  await click("مرحله قبل");
  assert.equal(await heading().textContent(), "تقه با چه اتفاقی هم‌زمان است؟");
  await click("گرم‌شدن لوله‌ها");
  assert.equal(await heading().textContent(), "انبساط و تماس لوله قابل بررسی است");
  await page.reload();
  await heading().waitFor();
  assert.equal(await heading().textContent(), "انبساط و تماس لوله قابل بررسی است");
  await page.goBack();
  assert.equal(await heading().textContent(), "تقه با چه اتفاقی هم‌زمان است؟");
  await page.goForward();
  assert.equal(await heading().textContent(), "انبساط و تماس لوله قابل بررسی است");
  await page.getByText(/^پاسخ‌های این بررسی/).click();
  await click("تغییر پاسخ پرسش ۲");
  await click("قل‌قل و گرمایش نامتوازن رادیاتور");
  assert.equal(await heading().textContent(), "هوای محبوس را در بررسی لحاظ کنید");
  assert(!page.url().includes("warming"));
  report.backReloadAndChangeEarlierAnswer = true;

  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Overflow at ${width}`,
    );
  }
  await page.reload();
  await heading().waitFor();
  report.mobileWidthsAndLargeText = true;

  await click("ثبت خلاصه در یادداشت‌های من");
  const textarea = page.getByLabel("متن آموزشی (Markdown)");
  const reportBody = await textarea.inputValue();
  assert(reportBody.includes("L24FF") && reportBody.includes("https://"));
  await textarea.fill(reportBody + "\n\nمشاهده شخصی آزمایشی فاز هفت");
  await page.evaluate(() => {
    window.phase7SetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await click("ذخیره مطلب");
  await page
    .getByText("ذخیره نشد؛ فضای دستگاه یا دسترسی حافظه را بررسی کنید.", { exact: true })
    .waitFor();
  assert((await textarea.inputValue()).includes("مشاهده شخصی آزمایشی فاز هفت"));
  await page.evaluate(() => {
    Storage.prototype.setItem = window.phase7SetItem;
  });
  await click("ذخیره مطلب");
  await page.locator("form[data-note-editor]").waitFor({ state: "hidden" });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("repair-library-v2")).notes.find(
      (note) => note.category === "بررسی‌های من",
    ),
  );
  assert(saved.body.includes("مشاهده شخصی آزمایشی فاز هفت") && !saved.content);
  await page.getByRole("link", { name: "بازگشت به جستجو", exact: true }).click();
  assert.equal(await page.locator("#library-search").inputValue(), "تقه");
  assert(new URL(page.url()).searchParams.get("model") === "L24FF");
  await page.goto(base + "/?q=" + encodeURIComponent("مشاهده شخصی آزمایشی فاز هفت"));
  await page.locator(`#results a[href*="${saved.id}"]`).waitFor();
  await page.getByText("پشتیبان و داده‌های من", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "دریافت فایل پشتیبان", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert(backup.notes.some((note) => note.id === saved.id && note.body === saved.body));
  report.offlineSaveQuotaRecoverySearchAndBackup = true;
  report.returnPreservesSearchAndModel = true;

  const scenarios = [
    [
      "hot-water",
      [
        "هیچ‌کدام را مشاهده نمی‌کنم",
        "فقط با روشن‌بودن گرمایش گرم می‌شود",
        "بله، نقشه همین مدل آن را نشان می‌دهد",
      ],
      "اختلال تغییر مسیر یکی از احتمال‌هاست",
    ],
    [
      "heating",
      [
        "هیچ‌کدام را مشاهده نمی‌کنم",
        "بله، درخواست گرمایش وجود دارد",
        "بالای رادیاتور سردتر است / گرمایش نامتوازن و قل‌قل دارد",
      ],
      "هوای محبوس قابل بررسی است",
    ],
    [
      "ignition",
      [
        "هیچ‌کدام را مشاهده نمی‌کنم",
        "روشن است و کد خطا ندارد",
        "هنگام درخواست گرمایش",
        "بله، درخواست فعال است",
      ],
      "شرایط شروع کار باید طبق مدل بررسی شود",
    ],
    [
      "noise",
      ["هیچ‌کدام را مشاهده نمی‌کنم", "تقه یا تق‌تق لوله‌ها", "باز یا بسته‌شدن شیر آب"],
      "ضربه قوچ قابل بررسی است",
    ],
    [
      "flue",
      [
        "هیچ‌کدام را مشاهده نمی‌کنم",
        "خیر، در بخش قابل مشاهده چنین چیزی نیست",
        "طول مسیر، زانوها یا محل پایانه",
      ],
      "جدول مسیر همان مدل لازم است",
    ],
  ];
  for (const [id, choices, expected] of scenarios) {
    await page.goto(base + "/diagnose?guide=" + id);
    for (const choice of choices) await click(choice);
    assert.equal(await heading().textContent(), expected);
    assert.equal(await page.evaluate(() => document.activeElement.id), "guide-step");
  }
  report.generalGuidesWithKeyboardFocus = true;
  await page.goto(base + "/note/ahi-pressure-drop#study-note");
  await page.getByLabel("متن یادداشت شخصی").fill("مثال خودم از افت فشار");
  await click("ذخیرهٔ یادداشت");
  await page.locator("#cycle button").click();
  await click("افزودن به علاقه‌مندی‌ها");
  await click("ویرایش متن آفلاین");
  await page.getByLabel("متن آموزشی (Markdown)").fill("نسخهٔ شخصی مطلب فشار");
  await click("ذخیره مطلب");
  await page.locator("form[data-note-editor]").waitFor({ state: "hidden" });
  const getLibrary = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("repair-library-v2")));
  const before = await getLibrary();
  assert(before.study.notes.some((note) => note.body === "مثال خودم از افت فشار"));
  assert(before.study.marks.some((mark) => mark.section === "cycle"));
  for (const [id, choices, target] of [
    [
      "pressure-drop",
      ["با گرمایش بالا می‌رود و بعد از سردشدن خیلی پایین می‌آید"],
      "ahi-pressure-drop#cycle",
    ],
    [
      "heating",
      ["بله، درخواست گرمایش وجود دارد", "رادیاتور انتهای مسیر سردتر از رادیاتورهای اول است"],
      "ahi-cold-radiators#local",
    ],
    ["hot-water", ["مقدار کمی آب اول داغ است و بعد ولرم می‌شود"], "ahi-d16#d16"],
  ]) {
    await page.goto(base + "/ahi-class");
    await page.locator('[aria-labelledby="class-diagnosis"] a[href*="' + id + '"]').click();
    await click("هیچ‌کدام را مشاهده نمی‌کنم");
    for (const choice of choices) await click(choice);
    const resultUrl = page.url();
    const resultTitle = await heading().textContent();
    await page.locator('nav[aria-label="مرور درس استاد آهی"] a[href$="' + target + '"]').click();
    await page.locator("#" + target.split("#")[1]).waitFor();
    if (id === "pressure-drop") {
      await page.getByText("از متن اصلی کلاس استاد آهی", { exact: true }).waitFor();
      await page.getByRole("heading", { name: "نسخهٔ ویرایش‌شدهٔ من" }).waitFor();
    }
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, "/note/" + target);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.goBack();
    await heading().waitFor();
    assert.equal(await heading().textContent(), resultTitle);
    assert.equal(page.url(), resultUrl);
    await page.reload();
    assert.equal(await heading().textContent(), resultTitle);
  }
  const after = await getLibrary();
  for (const key of ["notes", "favorites", "history"]) assert.deepEqual(after[key], before[key]);
  assert.deepEqual(after.study.notes, before.study.notes);
  assert.deepEqual(after.study.marks, before.study.marks);
  await click("ثبت خلاصه در یادداشت‌های من");
  assert(
    (await page.getByLabel("متن آموزشی (Markdown)").inputValue()).includes("/note/ahi-d16#d16"),
  );
  await click("ذخیره مطلب");
  await page.locator("form[data-note-editor]").waitFor({ state: "hidden" });
  const classReport = (await getLibrary()).notes.find((note) =>
    note.body.includes("/note/ahi-d16#d16"),
  );
  assert(classReport);
  await page.goto(base + "/note/" + classReport.id);
  await page.locator('article a[href="/note/ahi-d16#d16"]').click();
  await page.locator("#d16").waitFor();
  report.offlineClassRoutesAndPersonalData = true;
  for (const [choice, expected] of [
    ["بوی گاز یا شک به نشت گاز", "توقف فوری: احتمال نشت گاز"],
    ["آلارم CO یا احتمال مسمومیت با مونوکسیدکربن", "توقف فوری: احتمال مونوکسیدکربن"],
    ["بوی دود یا خروج دود به داخل", "توقف: احتمال خروج دود"],
    ["کوبش شدید یا افزایش غیرعادی دما", "توقف: کوبش شدید یا دمای غیرعادی"],
    ["از ایمنی وضعیت مطمئن نیستم", "ابتدا وضعیت ایمنی روشن شود"],
  ]) {
    await page.goto(base + "/diagnose?guide=ignition");
    await click(choice);
    assert.equal(await heading().textContent(), expected);
    assert.equal(
      await page.getByRole("button", { name: "ثبت خلاصه در یادداشت‌های من", exact: true }).count(),
      0,
    );
    assert.equal(await page.locator('section[aria-labelledby="guide-step"] button').count(), 0);
  }
  report.safetyStopsHaveNoDiagnosticContinuation = true;
  await page.goto(base + "/diagnose?guide=hot-water&v=3&answers=clear,heating");
  await click("نمی‌دانم / مشاهده نکرده‌ام");
  assert.equal(await heading().textContent(), "اطلاعات برای محدودکردن علت کافی نیست");
  report.unknownArchitectureDoesNotDiagnoseDiverter = true;
  for (const query of [
    "guide=noise&v=1&answers=clear,knock,tap",
    "guide=noise&v=2&answers=knock,tap",
    "guide=noise&v=0&answers=clear,knock,tap",
    "guide=noise&v=2&answers=gas,knock",
  ]) {
    await page.goto(base + "/diagnose?" + query);
    await page.getByRole("alert").filter({ hasText: "پاسخ‌های این پیوند" }).waitFor();
    assert.equal(await heading().textContent(), "پیش از شروع، نشانه خطر وجود دارد؟");
  }
  report.invalidAndOutdatedUrlsRestartSafetyGate = true;
  await page.goto(base + "/diagnose");
  await page.locator('main[aria-label="مسیرهای عیب‌یابی"]').waitFor();
  assert.equal(await page.locator('main[aria-label="مسیرهای عیب‌یابی"] a').count(), 6);
  await page.screenshot({ path: resolve(output, "paths-390.png"), fullPage: true });
  await page.goto(base + "/diagnose?guide=hot-water&v=3&answers=clear,heating,yes");
  await heading().waitFor();
  await page.screenshot({ path: resolve(output, "result-390.png"), fullPage: true });
  assert.deepEqual(errors, []);
  report.pageErrors = errors.length;
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(report);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
