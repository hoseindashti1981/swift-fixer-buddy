export function markdownLines(content: string): string[] {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").split(/\r?\n/);
}

export function headingAnchor(sectionId: string, line: number): string {
  return `${sectionId}--heading-${line + 1}`;
}
