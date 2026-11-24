import { readFile, writeFile } from "node:fs/promises";
import { searchKnowledge } from "../src/lib/search";
import originalTitles from "../docs/phase-3-search-targets.json";
import articles from "../content/articles.json";
import roundTwo from "../docs/phase-9-round-2/batch.json";

const titles = [
  ...originalTitles,
  ...articles
    .filter((article) => !originalTitles.some((row) => row.expectedArticleId === article.id))
    .map((article) => ({ query: article.title, expectedArticleId: article.id })),
];

const paraphrases = [
  ["دبی زیاد آب سرد", "ns-water-flow"],
  ["آب گرم فقط با روشن بودن شوفاژ", "ns-diverter"],
  ["فرمان گرمایش اجرا نمی شود", "ns-heat-command"],
  ["بالای شوفاژ سرده", "ns-radiator-air"],
  ["صدای کتری پکیج", "ns-kettling"],
  ["هر صدا نشانه خرابی", "ns-normal-noise"],
  ["تق تق لوله گرم سرد", "ns-pipe-expansion"],
  ["تقه بستن شیر", "ns-water-hammer"],
  ["دماسنج لیزری لوله مسی براق", "ns-ir-temperature"],
  ["جرقه هست شعله نیست", "ns-ignition"],
  ["فشار گاز مصرف همزمان", "ns-gas-load"],
  ["تعویض شیر گاز قطعه مشابه", "ns-gas-commission"],
  ["طول دودکش زانو", "ns-flue-length"],
  ["مهار دودکش آب بندی", "ns-flue-integrity"],
  ["شیب دودکش درجه درصد", "ns-flue-slope"],
  ["پرشر رو یکسره کنم", "ns-safety-bypass"],
  ["پکیج بوی گاز میده", "ns-gas-smell"],
  ["شیر آب بازه تقاضای آب گرم ثبت نمیشه", "ns-dhw-demand"],
  ["فن بعد خاموش شدن شعله کار میکند", "ns-overrun"],
  ["فن میچرخد مشعل روشن نمیشود", "ns-air-proof"],
  ["سرویس تنظیم پیچ شیر گاز", "ns-gas-factory"],
  ["فشار آزمون لوله گاز فشار کار", "ns-gas-pressure-test"],
  ["افت فشار آبگیری مکرر", "ns-system-pressure"],
  ["پایین رادیاتور بعد هواگیری سرد", "ns-radiator-bottom"],
  ["بعضی رادیاتورها سرد کنترل محلی", "ns-radiator-controls"],
  ["دمای تنظیمی آب مصرفی حالت کار", "ns-dhw-settings"],
  ["قل قل چگالشی سرمای شدید", "ns-condensate-cold"],
  ["آلارم مونوکسیدکربن حال بد", "ns-co-alert"],
  ...roundTwo.additions.map(({ query, expectedArticleId }) => [query, expectedArticleId]),
].map(([query, expectedArticleId]) => ({ query: query!, expectedArticleId: expectedArticleId! }));
const evaluate = (rows: typeof paraphrases) =>
  rows.map((row) => {
    const hits = searchKnowledge(row.query).hits;
    const rank = hits.findIndex((hit) => hit.note.id === row.expectedArticleId) + 1;
    return {
      ...row,
      rank: rank || null,
      top3: rank > 0 && rank <= 3,
      results: hits.slice(0, 3).map((hit) => hit.note.id),
    };
  });
const titleResults = evaluate(titles);
const paraphraseResults = evaluate(paraphrases);
const markdown = await readFile(
  new URL("../docs/search-evaluation-queries.fa.md", import.meta.url),
  "utf8",
);
const bank = [...markdown.matchAll(/^\| (Q\d{3}) \| (.+?) \| (.+?) \|$/gm)].map((match) => {
  const result = searchKnowledge(match[2]!);
  return {
    id: match[1],
    query: match[2],
    intent: match[3],
    status: result.needsDevice ? "needs-device" : "unlabelled-technical-coverage",
    reviewedCandidate: result.hasReviewedAnswer,
    top3: result.hits.slice(0, 3).map((hit) => hit.note.id),
  };
});
const timings: number[] = [];
for (let round = 0; round < 10; round++)
  for (const row of [...titles, ...paraphrases]) {
    const start = performance.now();
    searchKnowledge(row.query);
    timings.push(performance.now() - start);
  }
timings.sort((a, b) => a - b);
const rate = (rows: ReturnType<typeof evaluate>) =>
  rows.filter((row) => row.top3).length / rows.length;
const report = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  titleRecallAt3: rate(titleResults),
  paraphraseRecallAt3: rate(paraphraseResults),
  titleResults,
  paraphraseResults,
  bank,
  performance: {
    samples: timings.length,
    p50Ms: timings[Math.floor(timings.length * 0.5)],
    p95Ms: timings[Math.floor(timings.length * 0.95)],
  },
  limitations: [
    "Synthetic development queries; not a blind user study",
    "100-query bank has no complete technical answer labels; candidates are not proof of coverage",
    "Desktop timings exclude debounce, rendering and index startup; not a phone benchmark",
  ],
};
await writeFile(
  new URL("../docs/phase-4-search-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      titleRecallAt3: report.titleRecallAt3,
      paraphraseRecallAt3: report.paraphraseRecallAt3,
      performance: report.performance,
      misses: paraphraseResults.filter((row) => !row.top3),
    },
    null,
    2,
  ),
);
