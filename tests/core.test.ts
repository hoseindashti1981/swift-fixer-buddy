import { describe, expect, spyOn, test } from "bun:test";
import { createNoteSearch, normalizeSearch, searchNotes, highlightParts } from "../src/lib/search";
import { offlineAnswer, relevantPassage } from "../src/lib/ai-context";
import { readLines, responseDeltas } from "../src/lib/ai-stream";
import { handleAiRequest } from "../src/routes/api/ai-ask";
import type { Note } from "../src/data/notes";
import { notes } from "../src/data/notes";

const note = (id: string, title: string, body = ""): Note => ({
  id,
  title,
  body,
  tags: [],
  category: "آزمایش",
});
const stream = (text: string, width = 3) => {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width));
      controller.close();
    },
  });
};
const collect = async (iterator: AsyncGenerator<string>) => {
  const result = [];
  for await (const item of iterator) result.push(item);
  return result;
};

describe("search", () => {
  test("normalizes Persian, Arabic, digits and diacritics", () => {
    expect(normalizeSearch("پكیج ي E۰۱ ٠٢ گرم‌شدن")).toBe("پکیج ی e01 02 گرم شدن");
    expect(normalizeSearch("E ۰۱")).toBe("e01");
    expect(notes.every((note) => /[\p{L}\p{N}]/u.test(note.title))).toBe(true);
  });
  test("ranks titles, requires exact codes and matches reordered words", () => {
    const search = createNoteSearch([
      note("wrong", "خطای E010"),
      note("body", "راهنما", "ارور E01"),
      note("right", "ارور E01"),
      note("words", "فشار آب کم"),
    ]);
    expect(search("E۰۱").map((n) => n.id)).toEqual(["right", "body"]);
    expect(search("آب فشار")[0]?.id).toBe("words");
    expect(search("E99")).toEqual([]);
    expect(search(" ")).toEqual([]);
  });
  test("saved notes participate and changed collections invalidate their index", () => {
    expect(searchNotes("تستذخیره", [note("local", "تستذخیره")])[0]?.id).toBe("local");
    expect(searchNotes("تستذخیره", [])).toEqual([]);
    expect(highlightParts("Error E01", "e01").some((p) => p.hit && p.text === "E01")).toBe(true);
  });
  test("long queries on the real catalogue stay bounded", () => {
    const query = "علت روشن نشدن پکیج و کاهش فشار آب گرم چیست";
    const start = performance.now();
    for (let i = 0; i < 40; i++) searchNotes(query.slice(0, i + 2));
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe("offline references", () => {
  test("returns saved answers with clear provenance and no invented fallback", () => {
    expect(offlineAnswer("E01", [note("saved", "E۰۱", "پاسخ قبلی")]).text).toContain("پاسخ قبلی");
    const result = offlineAnswer("xyzunknown98271", []);
    expect(result.sources).toEqual([]);
    expect(result.text).toContain("اطلاعات کافی");
    expect(offlineAnswer("E01", []).sources.length).toBeGreaterThan(0);
  });
  test("retrieves matching passages beyond the beginning", () => {
    expect(
      relevantPassage(
        note("x", "راهنما", "مقدمه ".repeat(600) + "\n\nخطای سنسور دما"),
        "سنسور دما",
        100,
      ),
    ).toContain("سنسور دما");
  });
});

describe("streaming", () => {
  test("decodes split UTF-8, CRLF and a final line without newline", async () => {
    expect(await collect(readLines(stream("سلام\r\nپاسخ")))).toEqual(["سلام", "پاسخ"]);
  });
  test("requires explicit completion and reports interrupted responses", async () => {
    const delta = 'data: {"type":"response.output_text.delta","delta":"سلام"}\n';
    expect(
      await collect(responseDeltas(stream(delta + 'data: {"type":"response.completed"}'))),
    ).toEqual(["سلام"]);
    await expect(collect(responseDeltas(stream(delta)))).rejects.toThrow();
    await expect(
      collect(responseDeltas(stream('data: {"type":"response.failed"}\n'))),
    ).rejects.toThrow();
  });
});

describe("API boundaries", () => {
  test("uses trusted context and preserves completion and upstream failures", async () => {
    const key = process.env["OPENAI_API_KEY"];
    const model = process.env["OPENAI_MODEL"];
    process.env["OPENAI_API_KEY"] = "test-only";
    delete process.env["OPENAI_MODEL"];
    let input = "";
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      expect(url).toBe("https://api.openai.com/v1/responses");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer test-only");
      expect(headers.has("Lovable-API-Key")).toBe(false);
      const payload = JSON.parse(String(init?.body));
      expect(payload.model).toBe(process.env["OPENAI_MODEL"] || "chat-latest");
      expect(payload.store).toBe(false);
      expect(payload).not.toHaveProperty("reasoning");
      input = payload.input;
      return new Response(
        stream(
          'data: {"type":"response.output_text.delta","delta":"پاسخ"}\n' +
            'data: {"type":"response.completed"}\n',
        ),
      );
    });
    const request = () =>
      new Request("https://example.com/api/ai-ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "E01", context: "UNTRUSTED_INJECTED_CONTEXT" }),
      });
    try {
      const response = await handleAiRequest(request());
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"done":true');
      expect(input).toContain("[1]");
      expect(input).not.toContain("UNTRUSTED_INJECTED_CONTEXT");
      process.env["OPENAI_MODEL"] = "test-model-override";
      expect(await (await handleAiRequest(request())).text()).toContain('"done":true');
      fetchMock.mockImplementation(
        async () => new Response("secret provider detail", { status: 500 }),
      );
      const failed = await handleAiRequest(request());
      expect(failed.status).toBe(502);
      expect(await failed.text()).not.toContain("secret provider detail");
      process.env["OPENAI_API_KEY"] = "کلید_API_شما";
      fetchMock.mockClear();
      const invalidKey = await handleAiRequest(request());
      expect(invalidKey.status).toBe(503);
      expect(await invalidKey.text()).toContain("کلید OpenAI نامعتبر است");
      expect(fetchMock).not.toHaveBeenCalled();
      delete process.env["OPENAI_API_KEY"];
      expect((await handleAiRequest(request())).status).toBe(503);
    } finally {
      fetchMock.mockRestore();
      if (key === undefined) delete process.env["OPENAI_API_KEY"];
      else process.env["OPENAI_API_KEY"] = key;
      if (model === undefined) delete process.env["OPENAI_MODEL"];
      else process.env["OPENAI_MODEL"] = model;
    }
  });
  test("rejects malformed, oversized and cross-origin requests before calling AI", async () => {
    const request = (body: string, origin = "https://example.com") =>
      new Request("https://example.com/api/ai-ask", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body,
      });
    expect((await handleAiRequest(request('{"question":" "}'))).status).toBe(400);
    expect((await handleAiRequest(request("{"))).status).toBe(400);
    expect(
      (await handleAiRequest(request(JSON.stringify({ question: "x".repeat(9000) })))).status,
    ).toBe(413);
    expect((await handleAiRequest(request('{"question":"E01"}', "https://other.com"))).status).toBe(
      403,
    );
  });
});
