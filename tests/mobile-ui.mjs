import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  pathToFileURL(
    resolve(process.env.TEMP, "swift-fixer-browser-check/node_modules/playwright/index.mjs"),
  ).href
);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.APP_URL || "http://127.0.0.1:8080";
await mkdir("docs/phase-5-ui", { recursive: true });
const results = [];
try {
  for (const width of [360, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator("#library-search").waitFor();
    await page.locator("#library-search").pressSequentially("دودکش", { delay: 25 });
    await page.waitForTimeout(600);
    await page.locator("summary").filter({ hasText: "دستگاه و فیلترها" }).click();
    await page.getByLabel("برند (اختیاری)").fill("بوتان");
    await page.getByLabel("مدل دقیق (اختیاری)").fill("L24FF");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "راهنمای مستند", exact: true }).click();
    await page.waitForTimeout(300);
    const card = page.locator("#results ul > li a").first();
    await card.waitFor();
    assert(new URL(page.url()).searchParams.get("q") === "دودکش");
    await page.screenshot({ path: "docs/phase-5-ui/search-" + width + ".png", fullPage: true });
    await card.click();
    await page.getByRole("link", { name: "بازگشت به جستجو" }).click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#library-search").inputValue(), "دودکش");
    assert.equal(new URL(page.url()).searchParams.get("model"), "L24FF");
    assert.equal(new URL(page.url()).searchParams.get("brand"), "بوتان");
    assert.equal(new URL(page.url()).searchParams.get("category"), "راهنمای مستند");
    await page.reload();
    await page.waitForTimeout(600);
    assert.equal(await page.locator("#library-search").inputValue(), "دودکش");
    assert.equal(await page.getByLabel("مدل دقیق (اختیاری)").inputValue(), "L24FF");
    assert.equal(await page.getByLabel("برند (اختیاری)").inputValue(), "بوتان");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.goto(base + "/?limit=50");
    await page.locator("#results ul > li").nth(30).waitFor();
    const deepCard = page.locator("#results ul > li a").nth(30);
    await deepCard.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await deepCard.click();
    await page.getByRole("link", { name: "بازگشت به جستجو" }).click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => scrollY);
    assert.equal(await page.locator("#results ul > li").count(), 50);
    assert(Math.abs(after - before) < 100, "Scroll not restored: " + before + " -> " + after);
    await page.locator("#results ul > li a").nth(30).click();
    await page.getByRole("link", { name: "بازگشت به جستجو" }).waitFor();
    await page.goBack();
    await page.waitForTimeout(400);
    const backScroll = await page.evaluate(() => scrollY);
    assert(
      Math.abs(backScroll - before) < 100,
      "Browser back lost scroll at " +
        width +
        ": " +
        before +
        " -> " +
        backScroll +
        " URL " +
        page.url(),
    );
    await page.goto(base + "/note/ns-flue-length#answer");
    await page.locator("#answer").waitFor();
    await page.waitForTimeout(300);
    const anchorTop = await page
      .locator("#answer")
      .evaluate((node) => node.getBoundingClientRect().top);
    assert(anchorTop >= 0 && anchorTop < 200, "Anchor is obscured or not reached");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: "docs/phase-5-ui/article-" + width + ".png", fullPage: true });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "24px";
    });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Large text overflow",
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
      localStorage.setItem(
        "ai-saved-notes-v1",
        JSON.stringify([
          {
            id: "local-ui-fixture",
            title: "نمونه خواندن",
            category: "آزمون رابط",
            tags: [],
            body:
              "1. مرحله اول E01\n3. مرحله سوم F.28\n\n| ستون اول | ستون دوم | ستون سوم | ستون چهارم |\n|---|---|---|---|\n| یک | دو | سه | چهار |\n\n> هشدار نمونه\n\n[لینک نمونه](/)\n\n\x60\x60\x60txt\nVeryLongCodeLine".repeat(
                1,
              ) +
              "ABCDE".repeat(40) +
              "\n\x60\x60\x60",
          },
        ]),
      );
    });
    await page.goto(base + "/note/local-ui-fixture");
    await page.locator("article ol li").first().waitFor();
    assert.equal(await page.locator("article ol li").nth(1).getAttribute("value"), "3");
    assert(await page.locator("article table").isVisible());
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Table/code caused page overflow",
    );
    await page.screenshot({ path: "docs/phase-5-ui/reading-" + width + ".png", fullPage: true });
    assert.deepEqual(errors, []);
    results.push({
      width,
      searchFiltersAndReload: true,
      restoredScroll: { before, after },
      browserBack: true,
      noOverflow: true,
      largeText: true,
      pageErrors: errors,
    });
    await page.close();
  }
  await writeFile("docs/phase-5-ui/results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
