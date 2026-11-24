import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/lib/markdown";
import { parseSearchState } from "../src/lib/search-state";

test("URL state is bounded, round-trippable and ignores invalid input", () => {
  expect(parseSearchState({ q: ["bad"], brand: {}, model: "L24FF", limit: "50" })).toEqual({
    model: "L24FF",
    limit: 50,
  });
  expect(parseSearchState({ q: "x".repeat(2000), limit: Infinity }).q?.length).toBe(1000);
  expect(parseSearchState({ limit: -20 })).toEqual({});
  const state = {
    q: "شوفاژ سرد",
    model: "L24FF",
    brand: "ایران رادیاتور",
    category: "راهنمای مستند",
    limit: 50,
  };
  expect(parseSearchState(state)).toEqual(state);
});
test("reading preserves numbered steps, links, direction and scrollable tables", () => {
  const html = renderToStaticMarkup(
    <Markdown
      content={
        "1. قدم اول\n3. قدم سوم\n\n> هشدار\n\n[دفترچه](https://example.com)\n\n| کد | معنی |\n|---|---|\n| E01 | اشتعال |\n\n\x60\x60\x60txt\nE01\n\x60\x60\x60\n\n![نمونه](/icons/icon-192.png)"
      }
    />,
  );
  expect(html).toContain("<ol");
  expect(html).toContain('value="3"');
  expect(html).toContain("<blockquote");
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('<bdi dir="ltr">E01</bdi>');
  expect(html).toContain("overflow-x-auto");
  expect(html).toContain("<pre");
  expect(html).toContain('alt="نمونه"');
});
test("active URLs and raw imported metadata cannot become executable content", () => {
  const html = renderToStaticMarkup(
    <Markdown
      content={
        "---\ntags: [secret]\n---\n\x60\x60\x60dataview\nLIST FROM secret\n\x60\x60\x60\n[bad](javascript:evil)\n<script>alert(1)</script>"
      }
    />,
  );
  expect(html).not.toContain("secret");
  expect(html).not.toContain('href="javascript');
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;");
});
