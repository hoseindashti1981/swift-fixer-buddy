import type { ReactNode } from "react";

// Minimal Persian-friendly markdown renderer for note bodies:
// supports ## / ### headings, - and 1. lists, **bold**, tables, and paragraphs.
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const isTableRow = (l: string) => l.startsWith("|") && l.endsWith("|") && l.length > 2;
const isDivider = (l: string) => /^\|[\s:|-]+\|$/.test(l);
const cells = (l: string) =>
  l
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={key++} className="space-y-2 pr-1">
          {list.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-muted-foreground">{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();

    // Tables
    if (isTableRow(line) && !isDivider(line)) {
      const rows: string[][] = [];
      let hasHeader = false;
      let j = i;
      while (j < lines.length && isTableRow((lines[j] ?? "").trim())) {
        const l = (lines[j] ?? "").trim();
        if (isDivider(l)) {
          hasHeader = rows.length === 1;
        } else {
          rows.push(cells(l));
        }
        j++;
      }
      flushList();
      const head = hasHeader ? (rows[0] ?? null) : null;
      const bodyRows = hasHeader ? rows.slice(1) : rows;
      blocks.push(
        <div key={key++} className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-[13px]">
            {head && (
              <thead>
                <tr>
                  {head.map((c, ci) => (
                    <th
                      key={ci}
                      className="border border-border bg-secondary px-2.5 py-2 text-right font-bold text-foreground"
                    >
                      {renderInline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="border border-border px-2.5 py-2 align-top leading-relaxed text-muted-foreground"
                    >
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j - 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      list.push(line.replace(/^\d+[.)]\s+/, ""));
      continue;
    }
    flushList();
    if (!line || line === "-" || /^-{3,}$/.test(line)) continue;
    if (line.startsWith("#### ")) {
      blocks.push(
        <h4 key={key++} className="pt-1 text-sm font-bold text-foreground">
          {renderInline(line.slice(5))}
        </h4>,
      );
    } else if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="pt-2 text-base font-bold text-foreground">
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={key++}
          className="border-r-4 border-primary pr-3 pt-4 text-lg font-bold text-foreground first:pt-0"
        >
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="text-xl font-bold text-foreground">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else {
      blocks.push(
        <p key={key++} className="leading-relaxed text-muted-foreground">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
