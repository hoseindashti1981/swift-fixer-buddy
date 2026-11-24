import { expect, test } from "bun:test";
import { notes, type Note } from "../src/data/notes";
import { classSearchTargets } from "../src/data/class-search";
import {
  createNoteSearch,
  searchKnowledge,
  normalizeSearch,
  queryTokens,
  highlightParts,
  excerpt,
} from "../src/lib/search";
const note = (id: string, title: string, body = ""): Note => ({
  id,
  title,
  body,
  tags: [],
  category: "آزمون",
});
test("whole words, negative phrases, Persian forms and exact codes survive retrieval", () => {
  const search = createNoteSearch([
    note("substring", "شوفاژکار"),
    note("positive", "آب گرم می شود"),
    note("negative", "آب گرم نمی شود"),
    note("code", "خطای E01"),
    note("wrong-code", "خطای E010"),
  ]);
  expect(search("کار")).toEqual([]);
  expect(search("آب گرم نمیشه").map((n) => n.id)).toEqual(["negative"]);
  expect(search("آب گرم می شود").map((n) => n.id)).toEqual(["positive"]);
  expect(search("E ۰۱").map((n) => n.id)).toEqual(["code"]);
  expect(normalizeSearch("M ۲۴ FF F.۲۸")).toBe("m24ff f28");
  expect(queryTokens("گرم نمی‌شود")).toContain("نمی");
  expect(
    highlightParts("شوفاژکار کار", "کار")
      .filter((p) => p.hit)
      .map((p) => p.text),
  ).toEqual(["کار"]);
});
test("model filters use declared metadata, never a title guess", () => {
  const base = notes.find((n) => n.content)!;
  const model = (id: string, modelId: string): Note => ({
    ...base,
    id,
    title: "خطای E01",
    tags: [],
    body: "خطای E01",
    content: {
      ...base.content!,
      aliases: [],
      symptoms: [],
      errorCodes: ["E01"],
      sections: [{ id: "fault", title: "خطا", body: "E01", sourceIds: [] }],
      scope: {
        applicability: "models",
        brandIds: ["fixture"],
        modelIds: [modelId],
        architectures: [],
        operatingModes: [],
      },
    },
  });
  const search = createNoteSearch([
    model("right", "L24FF"),
    model("wrong", "L28FF"),
    note("unknown", "L24FF E01"),
  ]);
  expect(search("E01", { modelId: "L24FF", brandId: "fixture" }).map((n) => n.id)).toEqual([
    "right",
  ]);
  expect(search("L 24 FF E01").map((n) => n.id)).toEqual(["right"]);
});
test("section retrieval excludes boilerplate and links to the matching passage", () => {
  const base = notes.find((n) => n.content)!;
  const article: Note = {
    ...base,
    id: "sections-fixture",
    title: "راهنما",
    tags: [],
    content: {
      ...base.content!,
      aliases: [],
      symptoms: [],
      sections: [
        { id: "intro", title: "مقدمه", body: "متن مقدمه", sourceIds: [] },
        { id: "fault", title: "سنسور دما", body: "خرابی سنسور دما", sourceIds: [] },
        { id: "sources", title: "منابع", body: "کلمهساختگیمنابع", sourceIds: [] },
      ],
    },
  };
  const search = createNoteSearch([article]);
  expect(search("سنسور دما")[0]?.id).toBe(article.id);
  expect(search("کلمهساختگیمنابع")).toEqual([]);
  const result = searchKnowledge("خطای دماسنج لیزری روی لوله براق");
  expect(result.hits[0]?.note.id).toBe("ns-ir-temperature");
  expect(result.hits[0]?.sectionId).toBe("answer");
  expect(result.hits[0]?.passage).toContain("براق");
});
test("ambiguity, missing coverage and safety are explicit", () => {
  expect(searchKnowledge("E01").needsDevice).toBe(true);
  expect(searchKnowledge("xyzunknown98271").hits).toEqual([]);
  expect(searchKnowledge("xyzunknown98271").hasReviewedAnswer).toBe(false);
  expect(searchKnowledge("پکیج بوی گاز میده").hits[0]?.note.id).toBe("ns-gas-smell");
  expect(searchKnowledge("پرشر رو یکسره کنم").hits[0]?.note.id).toBe("ns-safety-bypass");
});

test("class phrasing opens the overview or exact class section declared for that symptom", () => {
  for (const target of classSearchTargets) {
    for (const query of target.phrases) {
      const hit = searchKnowledge(query).hits[0];
      expect([query, hit?.note.id, hit?.sectionId]).toEqual([query, target.id, target.sectionId]);
      if ("details" in target)
        expect(hit?.details?.map((section) => section.id)).toEqual(target.details);
    }
  }
  expect(searchKnowledge("چرا شوفاژ سرده؟").hits[0]?.note.id).toBe("ahi-cold-radiators");
  expect(searchKnowledge("فن می‌چرخه ولی جرقه نمی‌زنه").hits[0]?.sectionId).toBe("d43");
  expect(searchKnowledge("افت فشار", [], { modelId: "L24FF" }).hits[0]?.note.id).toBe(
    "ahi-pressure-drop",
  );
  const part = searchKnowledge("تست فلورگلاتور با آهنربا").hits[0];
  expect(part?.note.id).toBe("ahi-p10");
  expect(part?.sectionId).toMatch(/^p10--heading-\d+$/);
  expect(part?.sectionTitle).toContain("فلورگلاتور");
});

test("a preview includes the matching words even late in the passage", () => {
  const body = "توضیح مفصل اول ".repeat(20) + "[هواگیر رادیاتور](/note/ahi-p24) بررسی شد.";
  const preview = excerpt(body, "هواگیر رادیاتور");
  expect(preview).toContain("هواگیر رادیاتور");
  expect(preview).not.toContain("/note/");
});
