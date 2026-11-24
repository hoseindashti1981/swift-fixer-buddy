import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Article, ContentMetadata } from "../../src/data/content-schema";

const category = "کلاس استاد آهی";
const files = {
  faults: "Mr Ahi Class/مرجع_عیب‌ها_و_روش‌های_عیب‌یابی_جناب_آهی_تا_جلسه_ششم.md",
  parts: "Mr Ahi Class/مرجع_قطعات_و_جزئیات_جناب_آهی_تا_جلسه_ششم.md",
};
type Reference = keyof typeof files;

const sampleIds: Record<string, string> = {
  d04: "ahi-pressure-drop",
  d17: "ahi-cold-radiators",
  p11: "ahi-expansion-vessel",
};
const supplements: Record<string, string> = {
  d39: "d11",
  d40: "d22",
  d41: "d05",
  d42: "d04",
  d43: "d25",
  d44: "d27",
  d45: "d30",
  d46: "d17",
};
const partsByFault: Record<string, string> = {
  d01: "p02 p06 p07 p03",
  d02: "p11 p12 p05",
  d03: "p12 p11",
  d04: "p11 p05 p03 p01",
  d05: "p02 p03 p01",
  d06: "p03 p04",
  d07: "p04 p03 p22",
  d08: "p04 p02 p03",
  d09: "p05 p11 p02 p07",
  d10: "p05 p03",
  d11: "p08 p09 p10 p22",
  d12: "p08 p14 p06",
  d13: "p14 p07 p13 p15",
  d14: "p14 p07 p13",
  d15: "p14 p15 p07 p25",
  d16: "p14 p07 p15",
  d17: "p11 p13 p14 p24 p08 p04",
  d18: "p08 p14 p09 p10",
  d19: "p15 p08",
  d20: "p15 p08 p07 p26",
  d21: "p09 p07 p25",
  d22: "p16 p13 p14 p15 p24",
  d23: "p15 p22 p16",
  d24: "p17 p23",
  d25: "p19 p18 p20 p23",
  d26: "p18 p19 p22",
  d27: "p19 p22 p36",
  d28: "p18 p22 p19",
  d29: "p19 p20 p21 p18",
  d30: "p19 p20 p18 p23",
  d31: "p18 p20",
  d32: "p13 p14 p22",
  d33: "p25 p27 p28 p07",
  d34: "p25 p26 p28",
  d35: "p32 p25 p29",
  d36: "p32 p25 p29 p36",
  d37: "p33 p34 p25 p32",
  d38: "p25 p27 p28",
  d47: "p16 p04 p19 p36",
  d48: "p30 p29 p25",
};
const partFamilies: Record<string, string> = {
  p01: "p02 p03",
  p02: "p01 p05",
  p03: "p04 p05",
  p04: "p03 p22",
  p05: "p03 p11",
  p06: "p07 p13",
  p07: "p06 p14",
  p08: "p09 p10",
  p09: "p08 p10",
  p10: "p08 p09",
  p11: "p12 p05",
  p12: "p11 p05",
  p13: "p14 p24",
  p14: "p07 p13",
  p15: "p16 p22",
  p16: "p15 p13",
  p17: "p23 p19",
  p18: "p19 p20",
  p19: "p18 p20",
  p20: "p19 p21",
  p21: "p20 p23",
  p22: "p36 p18",
  p23: "p17 p21",
  p24: "p13 p11",
  p25: "p26 p27",
  p26: "p25 p27",
  p27: "p25 p28",
  p28: "p27 p25",
  p29: "p30 p32",
  p30: "p29 p25",
  p31: "p32 p33",
  p32: "p29 p33",
  p33: "p31 p34",
  p34: "p33 p36",
  p35: "p23 p27",
  p36: "p22 p33",
};
const aliases: Record<string, string[]> = {
  d01: ["فشار پکیج خود به خود بالا می‌رود", "بار در حالت خاموش بالا میره"],
  d02: ["فشار در زمستان بالا می‌رود", "فشار پکیج وقتی گرم میشه میره بالا"],
  d09: ["از شیلنگ تخلیه آب می‌ریزد"],
  d11: ["با باز کردن آب گرم پکیج روشن نمیشه", "شیر آب بازه دستگاه واکنش نداره"],
  d14: ["شوفاژ تو تابستون گرم میشه", "کویل داکت هنگام مصرفی گرم می‌شود"],
  d19: ["دوش یخ و داغ میشه", "سردوش گرفته"],
  d22: ["پکیج جوش میاره", "ارور حد", "اورلود"],
  d25: ["فن میچرخد ولی جرقه نمیزند", "فن کار میکنه ولی پکیج روشن نمیشه"],
  d36: ["جرقه میزنه شعله نداره"],
  d37: ["شعله میپره", "پکیج روشن میشه زود خاموش میشه"],
  p02: ["شیر آبگیری", "filling valve"],
  p03: ["گیج فشار", "فشارسنج آب", "ترنسدیوسر"],
  p04: ["واتر پرشر", "پرشر آب", "کلید نیم بار"],
  p05: ["شیر تخلیه سه بار", "سیفتی ولو"],
  p08: ["فلو سوئیچ", "رید رله"],
  p10: ["فلو رگلاتور", "فلو سنسور", "فلوی نافیدار"],
  p12: ["شیلنگ منبع", "رابط منبع باد"],
  p13: ["پمپ گردش", "سیرکولاسیون"],
  p14: ["شیر سه راهه", "شیر انحرافی", "دیورتر"],
  p15: ["ان تی سی", "سنسور دما", "ترمیستور"],
  p16: ["اورلود", "کلید حد"],
  p19: ["پرشر هوا", "پرشر فن"],
  p24: ["اتوونت", "هواگیر خودکار"],
  p25: ["گازوالو", "شیر گاز"],
  p26: ["مادولار", "بوبین مدولاسیون"],
  p29: ["ژیگلور", "اوریفیس"],
  p32: ["شمع جرقه", "ترانس جرقه"],
  p33: ["میله یون", "حسگر شعله"],
};

function articleId(code: string) {
  const main = supplements[code] ?? code;
  return sampleIds[main] ?? "ahi-" + main;
}

type Block = {
  ref: Reference;
  code: string;
  title: string;
  body: string;
  firstLine: number;
  lastLine: number;
};

function readBlocks(root: string, ref: Reference) {
  const lines = readFileSync(resolve(root, files[ref]), "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  const blocks: Block[] = [];
  let current: Omit<Block, "body" | "lastLine"> | undefined;
  let counter = 0;
  let fence = "";
  function begin(index: number, title: string, code: string) {
    if (current) {
      blocks.push({
        ...current,
        body: lines.slice(current.firstLine, index).join("\n").trim(),
        lastLine: index,
      });
    }
    current = { ref, code, title, firstLine: index + 1 };
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = "";
      continue;
    }
    if (fence) continue;
    const anchor = line.match(/^<a id="([dp]\d{2})"><\/a>$/);
    if (anchor) {
      const heading = lines[i + 1]?.match(/^#{3,4} (?:[DP]\d{2} — )?(.+)$/);
      if (!heading) throw new Error("Class source anchor without heading: " + anchor[1]);
      begin(i, heading[1]!, anchor[1]!);
      // The source range starts at the anchor and includes the heading on the next line.
      i++;
      continue;
    }
    const method = line.match(/^### (M\d{2}) — (.+)$/);
    const heading = line.match(/^#{1,2} (.+)$/);
    if (method) begin(i, method[2]!, method[1]!.toLowerCase());
    else if (heading) begin(i, heading[1]!, ref + "-" + ++counter);
  }
  if (!current || blocks[0]?.firstLine !== 1 || fence)
    throw new Error("Invalid class reference structure: " + files[ref]);
  blocks.push({
    ...current,
    body: lines.slice(current.firstLine).join("\n").trim(),
    lastLine: lines.length,
  });
  return blocks.map((block) =>
    /^[dp]\d{2}$/.test(block.code)
      ? { ...block, body: block.body.replace(/^#{3,4} .+\n?/, "").trim() }
      : block,
  );
}

function domain(code: string): ContentMetadata["domains"] {
  const n = Number(code.slice(1));
  if (code.startsWith("p")) {
    if (n >= 25 && n <= 36) return ["ignition"];
    if (n >= 17 && n <= 23 && n !== 22) return ["air-flue"];
    if ([6, 7, 8, 9, 10, 14, 15].includes(n)) return ["hot-water", "heating"];
  } else {
    if ([17, 32, 46].includes(n)) return ["heating", "pressure-circulation"];
    if ([11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 33].includes(n)) return ["hot-water"];
    if (n >= 24 && n <= 31) return ["air-flue"];
    if ((n >= 34 && n <= 38) || n === 48) return ["ignition"];
  }
  return ["pressure-circulation"];
}

export function importAhiClass(root: string, authored: Article[]) {
  const groups = new Map<string, Block[]>();
  for (const ref of ["faults", "parts"] as const) {
    const blocks = readBlocks(root, ref);
    const codes = blocks
      .filter((block) => /^[dp]\d{2}$/.test(block.code))
      .map((block) => block.code);
    const expected = Array.from(
      { length: ref === "faults" ? 48 : 36 },
      (_, index) => (ref === "faults" ? "d" : "p") + String(index + 1).padStart(2, "0"),
    );
    if (codes.length !== expected.length || expected.some((code) => !codes.includes(code)))
      throw new Error("Missing, duplicate or unexpected class cases: " + ref);
    for (const block of blocks) {
      const id = /^[dp]\d{2}$/.test(block.code)
        ? articleId(block.code)
        : /^m\d{2}$/.test(block.code)
          ? "ahi-methods"
          : "ahi-reference-" + ref;
      const items = groups.get(id) ?? [];
      items.push(block);
      groups.set(id, items);
    }
  }
  const destinations = new Map(
    [...groups].flatMap(([id, blocks]) =>
      blocks.map((block) => [block.code, { id, block }] as const),
    ),
  );
  function linkToCases(body: string) {
    return body.replace(/\]\(#([dp]\d{2})\)/g, (_, code: string) => {
      const destination = destinations.get(code);
      if (!destination?.block.body) throw new Error("Unknown class reference: " + code);
      return `](/note/${destination.id}#${code})`;
    });
  }
  const coverage: { file: string; lines: string; section: string; destination: string }[] = [];
  const articles: Article[] = [...groups].map(([id, blocks]) => {
    const main = blocks[0]!;
    const sample = authored.find((article) => article.id === id);
    const kind =
      id === "ahi-methods"
        ? "test"
        : id.startsWith("ahi-reference-")
          ? "checklist"
          : main.ref === "faults"
            ? "symptom"
            : "component";
    if (Object.values(sampleIds).includes(id) && !sample)
      throw new Error("Missing phase 1 class sample: " + id);
    const components = (partsByFault[main.code] ?? "").split(" ").filter(Boolean);
    const related =
      kind === "symptom"
        ? components.map(articleId)
        : kind === "component"
          ? [
              ...Object.entries(partsByFault)
                .filter(([, parts]) => parts.split(" ").includes(main.code))
                .slice(0, 4)
                .map(([code]) => articleId(code)),
              ...(partFamilies[main.code] ?? "").split(" ").filter(Boolean).map(articleId),
            ]
          : ["ahi-cold-radiators", "ahi-pressure-drop", "ahi-expansion-vessel"];
    const sections = [...(sample?.content.sections ?? [])];
    const sources: ContentMetadata["sources"] = [...(sample?.content.sources ?? [])];
    for (const block of blocks) {
      coverage.push({
        file: files[block.ref],
        lines: `${block.firstLine}–${block.lastLine}`,
        section:
          (/^[dpm]\d{2}$/.test(block.code) ? block.code.toUpperCase() + " · " : "") + block.title,
        destination: `/note/${id}#${block.code}`,
      });
      const sourceId = "class-" + block.code;
      const body = linkToCases(block.body);
      if (!body && !id.startsWith("ahi-reference-"))
        throw new Error("Empty class case: " + block.code);
      sections.push({
        id: block.code,
        title: block.title,
        body: body || "عنوان گروه پرونده‌ها در مرجع کلاس.",
        sourceIds: [sourceId],
      });
      sources.push({
        id: sourceId,
        kind: "technical-reference",
        title: block.ref === "faults" ? "مرجع عیب‌یابی کلاس" : "مرجع قطعات کلاس",
        publisher: category,
        url: null,
        path: files[block.ref],
        documentNumber: null,
        revision: null,
        locator: `${block.title} · خطوط ${block.firstLine} تا ${block.lastLine}`,
        accessedAt: null,
      });
    }
    const title =
      sample?.title ??
      (id === "ahi-reference-faults"
        ? "نمایه و منابع عیب‌یابی کلاس"
        : id === "ahi-reference-parts"
          ? "نمایه و منابع قطعات کلاس"
          : id === "ahi-methods"
            ? "روش‌های تشخیص در کلاس استاد آهی"
            : main.title);
    const searchAliases = [
      ...(sample?.content.aliases ?? []),
      ...(aliases[main.code] ?? []),
      ...blocks
        .filter((block) => /^[dp]\d{2}$/.test(block.code))
        .map((block) => block.code.toUpperCase()),
    ];
    const referenceText = sections
      .map((section) => `## ${section.title}\n\n${section.body}`)
      .join("\n\n");
    return {
      id,
      title,
      category,
      tags: searchAliases,
      body: referenceText,
      provenance: "source-summary",
      content: {
        schemaVersion: 2,
        revision: sample ? 2 : 1,
        kind,
        aliases: searchAliases,
        symptoms: kind === "symptom" ? blocks.map((block) => block.title) : [],
        componentIds: components.map(articleId),
        errorCodes: [],
        domains: kind === "symptom" || kind === "component" ? domain(main.code) : [],
        scope: {
          applicability: sample?.content.scope.applicability ?? "unknown",
          brandIds: [],
          modelIds: [],
          architectures: [],
          operatingModes: [],
        },
        summary:
          sample?.content.summary ??
          main.body.match(/^\*\*پرسش کلیدی برای تفکیک عیب:\*\* (.+)$/m)?.[1] ??
          main.body
            .match(
              /^(?:- \*\*اصل کار:\*\* |\*\*وظیفه، ساختمان، تفاوت گونه‌ها و جزئیات کلاس:\*\*\s*\n)([^\n]+)/m,
            )?.[1]
            ?.replace(/\*\*/g, "") ??
          null,
        sections,
        possibleCauses: sample?.content.possibleCauses ?? [],
        nextSteps: [],
        procedure: null,
        measurements: [],
        safety: {
          assessment: "unknown",
          requiredCompetence: "technician",
          hazards: [],
          stopConditions: [],
          ...sample?.content.safety,
        },
        sources,
        publication: {
          status: "needs-review",
          visibility: "available",
          reason: null,
          triagedAt: null,
          reviewedAt: null,
          reviewer: null,
          supersedes: null,
          replacedBy: null,
        },
        relatedIds: [...new Set([...(sample?.content.relatedIds ?? []), ...related])],
        observation: null,
      },
    };
  });
  const imported = new Set(articles.map((article) => article.id));
  const firstPages = [
    "ahi-reference-faults",
    "ahi-reference-parts",
    ...Object.values(sampleIds),
    "ahi-methods",
  ];
  const byId = new Map(articles.map((article) => [article.id, article]));
  return {
    articles: [
      ...authored.filter((article) => !imported.has(article.id)),
      ...firstPages.map((id) => byId.get(id)!),
      ...articles.filter((article) => !firstPages.includes(article.id)),
    ],
    coverage: coverage.sort(
      (a, b) => a.file.localeCompare(b.file) || parseInt(a.lines) - parseInt(b.lines),
    ),
  };
}
