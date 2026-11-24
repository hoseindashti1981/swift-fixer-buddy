import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  diagnosticGuides,
  GUIDE_REVISION,
  GUIDE_REVIEWED_AT,
  type DiagnosticGuide,
} from "@/data/diagnostic-guides";
import {
  classReadings,
  guideReference,
  guideReport,
  parseGuideState,
  walkGuide,
} from "@/lib/diagnostics";
import { parseSearchState, type SearchState } from "@/lib/search-state";
import { NoteEditor } from "@/components/NoteEditor";
import type { Note } from "@/data/notes";

export const Route = createFileRoute("/diagnose")({
  validateSearch: parseGuideState,
  head: () => ({
    meta: [
      { title: "عیب‌یابی مرحله‌ای آفلاین | راهنمای پکیج" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiagnosePage,
});

function Sources({ ids }: { ids: string[] }) {
  return (
    <details className="mt-4 rounded-xl border border-border p-3 text-sm leading-7">
      <summary className="min-h-11 cursor-pointer py-2 font-bold">مبنای این مرحله و منابع</summary>
      <p className="mb-3 text-xs text-muted-foreground">
        خلاصه‌ها آفلاین‌اند؛ بازکردن اصل منبع به اینترنت نیاز دارد. تطبیق متنی با منبع، بدون تأیید
        میدانی یا بازبین انسانی.
      </p>
      {ids.map((id) => {
        const ref = guideReference(id);
        return (
          ref && (
            <section key={id} className="mt-3 border-t border-border pt-3">
              <h3 className="font-bold">{ref.title}</h3>
              <p>{ref.summary}</p>
              {ref.sources.map((source) => (
                <p key={source.url} className="mt-2 break-words text-xs text-muted-foreground">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    <bdi>{source.title}</bdi>
                  </a>
                  {" · "}
                  <bdi>{source.publisher}</bdi>
                  {" · "}
                  <bdi>{source.locator}</bdi>
                </p>
              ))}
            </section>
          )
        );
      })}
      <p className="mt-3 text-xs text-muted-foreground">
        بازبینی منابع مسیر: <bdi>{GUIDE_REVIEWED_AT}</bdi> · نسخه {GUIDE_REVISION}
      </p>
    </details>
  );
}

function SaveReport({
  guide,
  answers,
  state,
}: {
  guide: DiagnosticGuide;
  answers: string[];
  state: SearchState;
}) {
  const [draft, setDraft] = useState<Note | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="mt-4">
      <button
        className="min-h-12 w-full rounded-xl border border-primary p-3 text-sm font-bold text-primary"
        onClick={() => {
          try {
            setDraft({ ...guideReport(guide, answers, state), id: `local-${crypto.randomUUID()}` });
            setError("");
          } catch {
            setError("خلاصه آماده نشد؛ منابع و مسیر را بررسی کنید.");
          }
        }}
        disabled={!!draft}
      >
        ثبت خلاصه در یادداشت‌های من
      </button>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        پیش از ذخیره می‌توانید مشاهده و نتیجه واقعی را به متن اضافه کنید. گزارش ذخیره‌شده در جست‌وجو
        و پشتیبان شما قرار می‌گیرد.
      </p>
      {error && <p role="alert">{error}</p>}
      {draft && <NoteEditor key={draft.id} note={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function DiagnosePage() {
  const state = parseGuideState(Route.useSearch());
  const navigate = Route.useNavigate();
  const search = parseSearchState(state);
  const guide = diagnosticGuides.find((item) => item.id === state.guide);
  const answers = state.answers ? state.answers.split(",") : [];
  const current = guide ? walkGuide(guide, answers) : null;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.guide) heading.current?.focus({ preventScroll: true });
  }, [state.guide, state.answers]);
  const move = (next: string[]) => {
    void navigate({
      search: {
        ...search,
        guide: guide!.id,
        v: GUIDE_REVISION,
        ...(next.length ? { answers: next.join(",") } : {}),
      },
      resetScroll: true,
    });
  };
  const refs = current?.node.refs ?? [];
  const hasSources = refs.every((id) => guideReference(id));
  const readings = guide && current && hasSources ? classReadings(guide.id, current.nodeId) : [];
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16">
      <header className="flex flex-wrap gap-2 py-4">
        <Link
          to="/"
          search={search}
          className="min-h-11 rounded-full bg-secondary px-4 py-3 text-sm"
        >
          بازگشت به جستجو
        </Link>
        {guide && (
          <Link to="/diagnose" search={search} className="min-h-11 px-3 py-3 text-sm text-primary">
            انتخاب مسیر دیگر
          </Link>
        )}
      </header>
      <h1 className="text-xl font-extrabold leading-9">عیب‌یابی مرحله‌ای</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        مسیرهای عمومی برای محدودکردن احتمال‌ها و تعیین قدم بعدی؛ کار داخلی نیازمند صلاحیت و روش همان
        مدل است.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        دستگاه ثبت‌شده:{" "}
        <bdi>{[state.brand, state.model].filter(Boolean).join(" / ") || "نامشخص"}</bdi> · این مسیرها
        پوشش اختصاصی مدل ندارند.
      </p>
      {state.reset && (
        <p role="alert" className="mt-3 rounded-xl border border-border p-3 text-sm leading-7">
          پاسخ‌های این پیوند معتبر یا هم‌نسخه نیستند؛ از ابتدا پاسخ دهید.
        </p>
      )}
      {!guide || !current ? (
        <main className="mt-5 space-y-3" aria-label="مسیرهای عیب‌یابی">
          {diagnosticGuides.map((item) => (
            <Link
              key={item.id}
              to="/diagnose"
              search={{ ...search, guide: item.id, v: GUIDE_REVISION }}
              className="block rounded-2xl border border-border bg-card p-4"
            >
              <h2 className="font-bold leading-8">{item.title}</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </main>
      ) : (
        <main className="mt-5">
          <p className="text-sm font-bold text-primary">{guide.title}</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            پاسخ‌ها مربوط به همین بررسی‌اند؛ برای دستگاه یا وضعیت تازه «شروع از ابتدا» را بزنید.
            برای پاسخ‌دادن محفظه را باز نکنید.
          </p>
          <div className="my-3 flex flex-wrap gap-2">
            {answers.length > 0 && (
              <>
                <button
                  className="min-h-11 rounded-xl bg-secondary px-4 text-sm"
                  onClick={() => move(answers.slice(0, -1))}
                >
                  مرحله قبل
                </button>
                <button className="min-h-11 px-4 text-sm text-primary" onClick={() => move([])}>
                  شروع از ابتدا
                </button>
              </>
            )}
            {current.nodeId !== "safety" && (
              <button className="min-h-11 px-4 text-sm text-destructive" onClick={() => move([])}>
                نشانه خطر تازه دارم
              </button>
            )}
          </div>
          {!hasSources ? (
            <p role="alert">منبع این مرحله در دسترس نیست؛ تا بازبینی محتوا ادامه ندهید.</p>
          ) : (
            <section
              className={
                "rounded-2xl border bg-card p-4 " +
                (current.node.kind === "result" && current.node.status === "stop"
                  ? "border-destructive"
                  : "border-border")
              }
              aria-labelledby="guide-step"
            >
              <p className="mb-2 text-xs text-muted-foreground">
                {current.node.kind === "question"
                  ? `پرسش ${(answers.length + 1).toLocaleString("fa-IR")}`
                  : current.node.status === "stop"
                    ? "توقف عیب‌یابی"
                    : current.node.status === "unknown"
                      ? "نیاز به اطلاعات بیشتر"
                      : "نتیجه اولیه · تشخیص قطعی نیست"}
              </p>
              <h2
                ref={heading}
                id="guide-step"
                tabIndex={-1}
                className="text-lg font-bold leading-8 outline-none"
              >
                {current.node.title}
              </h2>
              {current.node.kind === "question" ? (
                <>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {current.node.help}
                  </p>
                  <div className="mt-4 space-y-2">
                    {current.node.choices.map((choice) => (
                      <button
                        key={choice.id}
                        className="min-h-12 w-full rounded-xl border border-input px-4 py-3 text-start text-sm leading-7 hover:bg-accent focus-visible:outline focus-visible:outline-primary"
                        onClick={() => move([...answers, choice.id])}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-7">{current.node.explanation}</p>
                  <h3 className="mt-4 font-bold">قدم بعدی</h3>
                  <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-7">
                    {current.node.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}
          {readings.length > 0 && (
            <nav
              aria-label="مرور درس استاد آهی"
              className="mt-4 rounded-xl border border-border p-4"
            >
              <h3 className="font-bold">مرور درس استاد آهی</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                مثال‌ها و قطعات این مرحله از جزوهٔ کلاس · نیازمند بازبینی
              </p>
              <ul className="mt-2">
                {readings.map((reading) => (
                  <li key={reading.id + reading.anchor}>
                    <Link
                      to="/note/$id"
                      params={{ id: reading.id }}
                      search={search}
                      hash={reading.anchor}
                      className="block min-h-11 py-2 text-sm leading-7 text-primary underline"
                    >
                      {reading.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <Sources key={current.nodeId} ids={refs} />
          {!!current.trail.length && (
            <details className="mt-4 text-sm leading-7">
              <summary className="min-h-11 cursor-pointer py-2 font-bold">
                پاسخ‌های این بررسی ({current.trail.length.toLocaleString("fa-IR")})
              </summary>
              <ol className="space-y-3">
                {current.trail.map((entry, index) => (
                  <li key={entry.nodeId} className="rounded-xl bg-secondary p-3">
                    <p>{entry.question.title}</p>
                    <p className="font-bold">{entry.choice.label}</p>
                    <button
                      className="min-h-11 text-primary"
                      onClick={() => move(answers.slice(0, index))}
                    >
                      تغییر پاسخ پرسش {(index + 1).toLocaleString("fa-IR")}
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {hasSources && current.node.kind === "result" && current.node.status !== "stop" && (
            <SaveReport
              key={`${guide.id}/${state.answers}`}
              guide={guide}
              answers={answers}
              state={search}
            />
          )}
        </main>
      )}
    </div>
  );
}
