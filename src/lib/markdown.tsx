import type { ReactNode } from "react";
import { headingAnchor, markdownLines } from "./markdown-lines";
import { highlightParts, queryTokens } from "./search";

function safeContentUrl(value: string): string | null {
  if (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || value.startsWith("#")) return value;
  return null;
}
function highlight(text: string, tokens: ReadonlySet<string>): ReactNode {
  if (!tokens.size) return text;
  return highlightParts(text, tokens).map((part, index) =>
    part.hit ? (
      <mark key={index} className="rounded bg-primary/25 text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
function renderInline(text: string, tokens: ReadonlySet<string>): ReactNode[] {
  const parts = text
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label || target)
    .split(
      /(!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|\x60[^\x60]+\x60|[a-zA-Z][a-zA-Z0-9_.:/-]*|[0-9۰-۹٠-٩]+(?:[.:/][0-9۰-۹٠-٩]+)*)/g,
    );
  return parts.map((part, index) => {
    const link = part.match(/^(!?)\[([^\]]*)\]\(([^)]+)\)$/);
    if (link) {
      const url = safeContentUrl(link[3]!);
      if (!url) return <span key={index}>{highlight(link[2]!, tokens)}</span>;
      if (link[1])
        return (
          <img
            key={index}
            src={url}
            alt={link[2]}
            loading="lazy"
            className="my-3 h-auto max-w-full rounded-xl"
          />
        );
      return (
        <a
          key={index}
          href={url}
          className="text-primary underline underline-offset-4"
          target={url.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
        >
          {highlight(link[2]!, tokens)}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{renderInline(part.slice(2, -2), tokens)}</strong>;
    if (part.startsWith("\x60") && part.endsWith("\x60"))
      return (
        <code key={index} dir="auto" className="rounded bg-secondary px-1">
          {highlight(part.slice(1, -1), tokens)}
        </code>
      );
    if (/^[a-zA-Z0-9۰-۹٠-٩]/.test(part))
      return (
        <bdi key={index} dir="ltr">
          {highlight(part, tokens)}
        </bdi>
      );
    return <span key={index}>{highlight(part, tokens)}</span>;
  });
}
const row = (line: string) => line.startsWith("|") && line.endsWith("|");
const cells = (line: string) =>
  line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
export function Markdown({
  content,
  sectionId,
  query = "",
}: {
  content: string;
  sectionId?: string;
  query?: string;
}) {
  const lines = markdownLines(content);
  const tokens = new Set(queryTokens(query));
  const inline = (value: string) => renderInline(value, tokens);
  const blocks: ReactNode[] = [];
  let list: { text: string; number: number | null }[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    const items = list.map((item, i) => (
      <li key={i} value={item.number ?? undefined} className="py-1 ps-1">
        {inline(item.text)}
      </li>
    ));
    blocks.push(
      ordered ? (
        <ol key={blocks.length} start={list[0]!.number!} className="list-decimal space-y-1 ps-6">
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-1 ps-6">
          {items}
        </ul>
      ),
    );
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const fence = line.match(/^(\x60{3,}|~{3,})(.*)$/);
    if (fence) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) code.push(lines[i]!);
      if (fence[2]!.trim().toLowerCase() !== "dataview")
        blocks.push(
          <pre
            key={blocks.length}
            dir="auto"
            className="max-w-full overflow-x-auto rounded-xl bg-secondary p-3 text-sm"
          >
            <code>{code.join("\n")}</code>
          </pre>,
        );
      continue;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (numbered || bullet) {
      if (list.length && ordered !== Boolean(numbered)) flush();
      ordered = Boolean(numbered);
      list.push({
        text: numbered?.[2] ?? bullet![1]!,
        number: numbered ? Number(numbered[1]) : null,
      });
      continue;
    }
    flush();
    if (!line || /^[-_*]{3,}$/.test(line) || line === "-") continue;
    if (row(line)) {
      const rows: string[][] = [];
      let header = false;
      while (i < lines.length && row(lines[i]!.trim())) {
        const current = lines[i]!.trim();
        if (/^\|[\s:|-]+\|$/.test(current)) header = rows.length === 1;
        else rows.push(cells(current));
        i++;
      }
      i--;
      blocks.push(
        <div
          key={blocks.length}
          role="region"
          aria-label="جدول قابل پیمایش"
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-lg border border-border"
        >
          <table className="w-full border-collapse text-sm">
            {header && (
              <thead>
                <tr>
                  {rows[0]!.map((cell, ci) => (
                    <th
                      key={ci}
                      scope="col"
                      className="border border-border bg-secondary px-3 py-2 text-start"
                    >
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.slice(header ? 1 : 0).map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci} className="min-w-24 border border-border px-3 py-2 align-top">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) {
      const Tag = ("h" + Math.min(heading[1]!.length + 1, 6)) as "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(
        <Tag
          key={blocks.length}
          id={sectionId && heading[1]!.length >= 3 ? headingAnchor(sectionId, i) : undefined}
          className="scroll-mt-24 pt-3 text-lg font-bold"
        >
          {inline(heading[2]!)}
        </Tag>,
      );
    } else if (line.startsWith(">")) {
      blocks.push(
        <blockquote
          key={blocks.length}
          className="border-s-4 border-primary ps-3 text-muted-foreground"
        >
          {inline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="text-muted-foreground">
          {inline(line)}
        </p>,
      );
    }
  }
  flush();
  return (
    <div className="min-w-0 space-y-4 text-[15px] leading-8 [overflow-wrap:anywhere]">{blocks}</div>
  );
}
