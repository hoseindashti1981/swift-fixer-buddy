import {
  diagnosticGuides,
  guideNodes,
  GUIDE_REVISION,
  type DiagnosticGuide,
  type GuideQuestion,
  type GuideChoice,
} from "@/data/diagnostic-guides";
import { notes, type Note } from "@/data/notes";
import { quarantine } from "@/data/content-policy";
import { classGuides } from "@/data/class-guide-readings";
import { parseSearchState, type SearchState } from "./search-state";

export type GuideAnswer = { nodeId: string; question: GuideQuestion; choice: GuideChoice };
export function walkGuide(guide: DiagnosticGuide, answers: string[]) {
  const nodes = guideNodes(guide);
  let nodeId = "safety";
  const trail: GuideAnswer[] = [];
  for (const answer of answers.slice(0, 20)) {
    const node = nodes[nodeId];
    if (!node || node.kind !== "question") break;
    const choice = node.choices.find((item) => item.id === answer);
    if (!choice || !nodes[choice.next]) break;
    trail.push({ nodeId, question: node, choice });
    nodeId = choice.next;
  }
  return { nodeId, node: nodes[nodeId]!, trail, valid: trail.length === answers.length };
}

export type GuideState = SearchState & {
  guide?: string;
  v?: string;
  answers?: string;
  reset?: boolean;
};
export function parseGuideState(raw: Record<string, unknown>): GuideState {
  // The router merges validated search with raw params; explicit empty values replace invalid ones.
  const state: GuideState = {
    ...parseSearchState(raw),
    guide: "",
    v: GUIDE_REVISION,
    answers: "",
    reset: false,
  };
  const guide = diagnosticGuides.find((item) => item.id === raw["guide"]);
  if (!guide) {
    if (raw["guide"]) state.reset = true;
    return state;
  }
  state.guide = guide.id;
  state.v = GUIDE_REVISION;
  if (raw["reset"] === true) {
    state.reset = true;
    return state;
  }
  if (raw["answers"] !== undefined && raw["answers"] !== "") {
    // Revision 3 only changed the class guides. Keep existing links for the other guides.
    const compatibleV2 =
      (raw["v"] === "2" || raw["v"] === 2) && ["noise", "ignition", "flue"].includes(guide.id);
    if (
      (!compatibleV2 && raw["v"] !== GUIDE_REVISION && raw["v"] !== Number(GUIDE_REVISION)) ||
      typeof raw["answers"] !== "string" ||
      raw["answers"].length > 500
    ) {
      state.reset = true;
    } else {
      const answers = raw["answers"].split(",");
      if (walkGuide(guide, answers).valid) state.answers = answers.join(",");
      else state.reset = true;
    }
  }
  return state;
}

export type GuideReference = {
  id: string;
  title: string;
  summary: string;
  sources: { title: string; publisher: string | null; url: string; locator: string | null }[];
};
export function classReadings(guideId: string, nodeId: string) {
  const targets = classGuides.find((guide) => guide.id === guideId)?.readings[nodeId] ?? [];
  return targets.map((target) => {
    const [id, anchor] = target.split("#");
    const note = notes.find((item) => item.id === id && item.category === "کلاس استاد آهی");
    const section = note?.content?.sections.find((item) => item.id === anchor);
    if (!note || !section || quarantine.has(note.id))
      throw new Error(`Invalid class reading: ${target}`);
    return { id: note.id, anchor: section.id, title: section.title };
  });
}

export function guideReference(id: string): GuideReference | null {
  if (id === "flue-emergency")
    return {
      id,
      title: "اقدام در صورت بوی دود در محل",
      summary:
        "دفترچه HOME REGULAR در بخش ایمنی، تهویه، خاموش‌کردن دستگاه و اطلاع به فرد دارای صلاحیت را برای بوی دود بیان می‌کند. اگر احتمال نشت گاز هم هست، دستور بوی گاز مقدم است.",
      sources: [
        {
          title: "HOME REGULAR Operating instructions",
          publisher: "Vaillant",
          url: "https://professional.vaillant.co.uk/downloads/home-manuals/home-regular-operatinginstructions-658411.pdf",
          locator: "0020224339_00 · §1.3.3 p.4",
        },
      ],
    };
  // Only the published reference can support a rule; personal edits never inherit its authority.
  const note = notes.find((item) => item.id === id);
  const content = note?.content;
  if (
    !note ||
    quarantine.has(id) ||
    !content?.summary ||
    content?.publication.status !== "verified" ||
    content.publication.visibility !== "available"
  )
    return null;
  const sourceIds = new Set(content.sections.find((section) => section.id === "answer")?.sourceIds);
  const sources = content.sources
    .filter((source) => sourceIds.has(source.id) && source.url?.startsWith("https://"))
    .map((source) => ({
      title: source.title,
      publisher: source.publisher,
      url: source.url!,
      locator: source.locator,
    }));
  return sources.length ? { id, title: note.title, summary: content.summary, sources } : null;
}

export function guideReport(
  guide: DiagnosticGuide,
  answers: string[],
  state: SearchState,
): Omit<Note, "id"> {
  const { node, nodeId, trail, valid } = walkGuide(guide, answers);
  if (!valid || node.kind !== "result") throw new Error("مسیر هنوز کامل نشده است.");
  const refs = [...new Set([...trail.flatMap((entry) => entry.question.refs), ...node.refs])];
  const readings = classReadings(guide.id, nodeId);
  const body = [
    `## بررسی مرحله‌ای: ${guide.title}`,
    `زمان ثبت: ${new Date().toISOString()}`,
    `نسخه مسیر: ${GUIDE_REVISION}`,
    `دستگاه ثبت‌شده: ${[state.brand, state.model].filter(Boolean).join(" / ") || "نامشخص"}`,
    "دامنه: راهنمای عمومی؛ سازگاری اختصاصی با مدل و خرابی قطعه تأیید نشده است. این گزارش مشاهده ثبت‌شده کاربر است، نه تأیید تعمیر یا ایمنی.",
    "## پاسخ‌های ثبت‌شده",
    ...trail.map(
      (entry, index) => `${index + 1}. ${entry.question.title}\nپاسخ: ${entry.choice.label}`,
    ),
    `## ${node.title}`,
    node.explanation,
    "## قدم بعدی",
    ...node.nextSteps.map((step, index) => `${index + 1}. ${step}`),
    ...(readings.length
      ? [
          "## مرور درس استاد آهی",
          ...readings.map(
            (reading) => `- [${reading.title}](/note/${reading.id}#${reading.anchor})`,
          ),
        ]
      : []),
    "## منابع مسیر",
    ...refs.flatMap((id) => {
      const ref = guideReference(id);
      if (!ref) throw new Error("منبع مسیر در دسترس نیست.");
      return ref.sources.map(
        (source) => `- [${source.title}](${source.url}) — ${source.locator ?? ""}`,
      );
    }),
  ].join("\n\n");
  return {
    title: `بررسی: ${guide.title}`,
    category: "بررسی‌های من",
    tags: ["عیب‌یابی مرحله‌ای", guide.title],
    body,
  };
}

export function validateGuides(): { guides: number; branches: number } {
  for (const entry of classGuides) {
    const guide = diagnosticGuides.find((item) => item.id === entry.id);
    if (
      !guide ||
      !notes.some((note) => note.id === entry.topic && note.category === "کلاس استاد آهی")
    )
      throw new Error(`Missing class guide or topic: ${entry.id}`);
    for (const nodeId of Object.keys(entry.readings)) {
      if (!guide.nodes[nodeId]) throw new Error(`Missing class step: ${entry.id}/${nodeId}`);
      classReadings(entry.id, nodeId);
    }
  }
  let branches = 0;
  const ids = new Set<string>();
  for (const guide of diagnosticGuides) {
    if (ids.has(guide.id)) throw new Error(`Duplicate guide: ${guide.id}`);
    ids.add(guide.id);
    const nodes = guideNodes(guide);
    const reached = new Set<string>();
    function visit(id: string, path: Set<string>) {
      const node = nodes[id];
      if (!node || path.has(id)) throw new Error(`Broken or cyclic guide: ${guide.id}/${id}`);
      reached.add(id);
      if (!node.refs.length || node.refs.some((ref) => !guideReference(ref)))
        throw new Error(`Missing verified source: ${guide.id}/${id}`);
      if (node.kind === "result") {
        if (!node.explanation || !node.nextSteps.length) throw new Error(`Empty result: ${id}`);
        branches++;
        return;
      }
      if (
        new Set(node.choices.map((choice) => choice.id)).size !== node.choices.length ||
        !node.choices.some((choice) => choice.id === "unknown")
      )
        throw new Error(`Invalid choices: ${id}`);
      for (const choice of node.choices) visit(choice.next, new Set([...path, id]));
    }
    visit("safety", new Set());
    if (Object.keys(nodes).some((id) => !reached.has(id)))
      throw new Error(`Unreachable node: ${guide.id}`);
  }
  return { guides: ids.size, branches };
}
