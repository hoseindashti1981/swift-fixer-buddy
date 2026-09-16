import type { ReactNode } from "react";

// Minimal Persian-friendly markdown renderer for note bodies:
// supports ## / ### headings, - lists, **bold**, and paragraphs.
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

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line) continue;
    if (line.startsWith("### ")) {
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
