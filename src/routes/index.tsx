import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { notes, type Note } from "@/data/notes";
import {
  excerpt,
  highlightParts,
  matchesDevice,
  searchKnowledge,
  type SearchHit,
} from "@/lib/search";
import { parseSearchState, type SearchState } from "@/lib/search-state";
import { saveSearchPosition, useSearchPosition } from "@/lib/search-scroll";
import { useSavedNotes } from "@/lib/saved-notes";
import { NoteEditor } from "@/components/NoteEditor";
import { contentReviewLabel, quarantine } from "@/data/content-policy";
import { LibraryBackup } from "@/components/LibraryBackup";
import { useLibraryState } from "@/lib/library-hooks";
import { recordSearch } from "@/lib/library-storage";

export const Route = createFileRoute("/")({
  validateSearch: parseSearchState,
  head: () => ({
    meta: [
      { title: "راهنمای سریع پکیج شوفاژ دیواری | عیب‌یابی و کدهای خطا" },
      {
        name: "description",
        content: "جست‌وجوی آفلاین علامت، قطعه و کد خطا با دامنه دستگاه و منابع مشخص",
      },
    ],
  }),
  component: Index,
});
function useDebounced(value: string) {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  return current;
}
function SearchHighlight({ text, query }: { text: string; query: string }) {
  return highlightParts(text, query).map((part, i) =>
    part.hit ? (
      <mark key={i} className="rounded bg-primary/25 text-inherit">
        {part.text}
      </mark>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
function NoteCard({
  note,
  query,
  hit,
  state,
}: {
  note: Note;
  query: string;
  hit: SearchHit | undefined;
  state: SearchState;
}) {
  const preview = excerpt(hit?.passage || note.content?.summary || note.body, query);
  return (
    <>
      <Link
        to="/note/$id"
        params={{ id: note.id }}
        search={state}
        hash={hit?.sectionId ?? ""}
        onClick={() => saveSearchPosition(state)}
        className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors active:bg-accent"
      >
        <span className="text-xs text-primary">{note.category}</span>
        <h2 className="mt-2 text-base font-bold leading-7">
          <SearchHighlight text={note.title} query={query} />
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{contentReviewLabel(note)}</p>
        {hit && (
          <p className="text-xs leading-6 text-muted-foreground">
            {hit.scope === "general"
              ? "راهنمای عمومی"
              : hit.scope === "model"
                ? "مدل مشخص"
                : "دامنه دستگاه نامعلوم"}
            {hit.confidence === "limited" && " · ارتباط احتمالی"}
            {hit.match === "fuzzy" && " · املای نزدیک"}
            {hit.details?.length && " · مرور همهٔ علت‌ها"}
            {hit.sectionTitle && (
              <>
                {" "}
                · <SearchHighlight text={hit.sectionTitle} query={query} />
              </>
            )}
          </p>
        )}
        <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">
          <SearchHighlight text={preview} query={query} />
        </p>
      </Link>
      {hit?.details && (
        <nav aria-label="رفتن مستقیم به یک بخش" className="mt-2 grid grid-cols-2 gap-2">
          {hit.details.map((section) => (
            <Link
              key={section.id}
              to="/note/$id"
              params={{ id: note.id }}
              search={state}
              hash={section.id}
              onClick={() => saveSearchPosition(state)}
              className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 py-1 text-xs leading-6 text-primary"
            >
              {section.title}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
function Index() {
  // Router search also contains raw URL values; sanitize before using them in the UI.
  const state = parseSearchState(Route.useSearch());
  useSearchPosition(state);
  const navigate = Route.useNavigate();
  const query = state.q ?? "";
  const debouncedQuery = useDebounced(query);
  const saved = useSavedNotes();
  const { data: library } = useLibraryState();
  const favoritesOnly = state.favorites ?? false;
  const [storageError, setStorageError] = useState("");
  const [adding, setAdding] = useState(false);
  const update = (patch: SearchState) =>
    void navigate({
      search: (prev) => parseSearchState({ ...prev, ...patch, limit: patch.limit ?? 25 }),
      replace: true,
      resetScroll: false,
    });
  const device = useMemo(
    () => ({
      ...(state.model?.trim() ? { modelId: state.model.trim() } : {}),
      ...(state.brand?.trim() ? { brandId: state.brand.trim() } : {}),
    }),
    [state.model, state.brand],
  );
  const allNotes = useMemo(() => {
    const ids = new Set(saved.map((note) => note.id));
    return [...saved, ...notes.filter((note) => !ids.has(note.id))];
  }, [saved]);
  const scoped = useMemo(
    () => allNotes.filter((note) => matchesDevice(note, device)),
    [allNotes, device],
  );
  const deviceRecords = notes.filter((note) => note.content?.scope.applicability === "models");
  const brands = [...new Set(deviceRecords.flatMap((note) => note.content!.scope.brandIds))];
  const models = [
    ...new Set(
      deviceRecords
        .filter((note) => !device.brandId || note.content!.scope.brandIds.includes(device.brandId))
        .flatMap((note) => note.content!.scope.modelIds),
    ),
  ];
  const results = useMemo(
    () => searchKnowledge(debouncedQuery, saved, device),
    [debouncedQuery, saved, device],
  );
  const searching = debouncedQuery.trim().length >= 2;
  const categories = [...new Set(allNotes.map((note) => note.category))];
  const filtered = (searching ? results.hits.map((hit) => hit.note) : scoped).filter(
    (note) =>
      (!state.category || note.category === state.category) &&
      (!favoritesOnly || library?.favorites.includes(note.id)),
  );
  const visible = filtered.slice(0, state.limit ?? 25);
  const checked = filtered.some((note) => note.content?.publication.status === "verified");
  const limited =
    !filtered.length ||
    (searching &&
      results.hits
        .filter((hit) => filtered.includes(hit.note))
        .every((hit) => hit.confidence === "limited"));
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-10">
      <a href="#results" className="sr-only focus:not-sr-only">
        رفتن به نتایج
      </a>
      <header className="flex items-center gap-3 pb-3 pt-5">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
        <div>
          <h1 className="text-lg font-extrabold">راهنمای پکیج</h1>
          <p className="text-xs leading-6 text-muted-foreground">
            علامت، کد خطا یا قطعه را جست‌وجو کنید
          </p>
        </div>
        <Link
          to="/ahi-class"
          className="ms-auto rounded-xl bg-secondary px-3 py-3 text-sm font-medium"
        >
          کلاس استاد آهی
        </Link>
      </header>
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur">
        <label className="sr-only" htmlFor="library-search">
          جستجو در راهنمای پکیج
        </label>
        <div className="relative">
          <input
            id="library-search"
            type="search"
            value={query}
            maxLength={1000}
            inputMode="search"
            enterKeyHint="search"
            onChange={(event) => update({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                try {
                  recordSearch(query);
                } catch {
                  setStorageError("تاریخچه ذخیره نشد؛ حافظه دستگاه را بررسی کنید.");
                }
                event.currentTarget.blur();
              }
            }}
            placeholder="مثلاً آب گرم نمی‌شود، E01، صدای کتری…"
            className="h-14 w-full rounded-2xl border border-input bg-card px-4 pl-14 text-base outline-none focus:border-primary"
          />
          {query && (
            <button
              aria-label="پاک کردن جستجو"
              onClick={() => update({ q: "" })}
              className="absolute left-1 top-1 h-12 w-12 rounded-xl text-lg"
            >
              ×
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="دسته مطالب">
          {["همه", ...categories].map((category) => {
            const active = category === "همه" ? !state.category : state.category === category;
            return (
              <button
                key={category}
                aria-pressed={active}
                onClick={() => update({ category: category === "همه" ? "" : category })}
                className={
                  "min-h-11 shrink-0 rounded-full px-4 text-sm " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground")
                }
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
      <nav aria-label="ابزارهای عیب‌یابی" className="my-3 grid grid-cols-2 gap-2">
        <Link
          to="/ai"
          search={{ q: query.trim() }}
          className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-3 py-2 text-center text-sm font-bold leading-6 text-primary-foreground"
        >
          دستیار هوش مصنوعی
        </Link>
        <Link
          to="/diagnose"
          search={state}
          onClick={() => saveSearchPosition(state)}
          className="flex min-h-14 items-center justify-center rounded-2xl border border-primary bg-primary/10 px-3 py-2 text-center text-sm font-bold leading-6 text-primary"
        >
          عیب‌یابی مرحله‌ای آفلاین
        </Link>
      </nav>
      {storageError && (
        <p role="alert" className="text-sm text-destructive">
          {storageError}
        </p>
      )}
      <button
        onClick={() =>
          void navigate({
            search: (prev) => parseSearchState({ ...prev, favorites: !favoritesOnly, limit: 25 }),
            replace: true,
            resetScroll: false,
          })
        }
        aria-pressed={favoritesOnly}
        className="min-h-11 rounded-xl px-3 text-sm text-primary"
      >
        {favoritesOnly ? "نمایش همه مطالب" : "فقط علاقه‌مندی‌ها"}
      </button>
      {!!library?.history.length && (
        <details className="text-sm leading-7">
          <summary className="min-h-11 cursor-pointer py-2">جست‌وجوهای اخیر</summary>
          <div className="flex flex-wrap gap-2">
            {library.history.slice(0, 10).map((entry) => (
              <button
                key={entry.query}
                className="min-h-11 rounded-xl bg-secondary px-3"
                onClick={() => update({ q: entry.query })}
              >
                {entry.query}
              </button>
            ))}
          </div>
        </details>
      )}
      <details className="mt-2 rounded-2xl border border-border bg-card p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-bold leading-[44px]">
          دستگاه و فیلترها{" "}
          {state.model || state.brand
            ? "· " + [state.brand, state.model].filter(Boolean).join(" / ")
            : "· همه دستگاه‌ها"}
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
          <label className="text-sm">
            برند (اختیاری)
            <input
              list="known-brands"
              value={state.brand ?? ""}
              maxLength={80}
              onChange={(event) => update({ brand: event.target.value, model: "" })}
              placeholder="برند دستگاه"
              className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-base"
            />
          </label>
          <label className="text-sm">
            مدل دقیق (اختیاری)
            <input
              list="known-models"
              value={state.model ?? ""}
              maxLength={80}
              dir="auto"
              onChange={(event) => update({ model: event.target.value })}
              placeholder="مثلاً L24FF"
              className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-base"
            />
          </label>
          <datalist id="known-brands">
            {brands.map((brand) => (
              <option key={brand} value={brand} />
            ))}
          </datalist>
          <datalist id="known-models">
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          با انتخاب دستگاه، فقط مطالب با دامنه صریح همان دستگاه و راهنماهای عمومی دیده می‌شوند. نام
          مدل در عنوان، تأیید سازگاری نیست.
        </p>
        {!deviceRecords.length && (
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            هنوز فهرست مدل‌های دارای دامنه تأییدشده آماده نیست؛ ورود مدل ممکن است فقط راهنماهای
            عمومی را باقی بگذارد.
          </p>
        )}
        <button
          onClick={() => update({ brand: "", model: "", category: "", favorites: false })}
          className="mt-2 min-h-11 px-3 text-sm text-primary"
        >
          پاک کردن فیلترها
        </button>
      </details>
      <details className="mt-3 text-xs leading-6 text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-2">
          وضعیت محتوا · {quarantine.size.toLocaleString("fa-IR")} مطلب در انتظار اصلاح
        </summary>
        <p>
          وضعیت بررسی روی هر مطلب مشخص است. اعداد و آزمون‌ها را با دفترچه همان مدل تطبیق دهید. مطالب
          متوقف‌شده در نتایج نمایش داده نمی‌شوند.
        </p>
      </details>
      <main id="results" className="scroll-mt-36 pt-3" aria-busy={query !== debouncedQuery}>
        <div role="status" className="mb-4 text-sm leading-7 text-muted-foreground">
          <p>
            {filtered.length.toLocaleString("fa-IR")}{" "}
            {searching ? "نتیجه برای «" + debouncedQuery.trim() + "»" : "مطلب"}
          </p>
          {searching && results.needsDevice && (
            <p>تفسیر کد به مدل و منبع همان دستگاه نیاز دارد؛ تطبیق مدل تأیید نشده است.</p>
          )}
          {searching && !checked && <p>در این فیلتر، پاسخ بررسی‌شده با منبع پیدا نشد.</p>}
          {searching && limited && (
            <p>ارتباط نتایج محدود است؛ علامت دقیق و حالت کار را اضافه کنید.</p>
          )}
        </div>
        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm leading-7">
            <p className="font-bold">مطلبی با این انتخاب پیدا نشد</p>
            <p className="mt-2 text-muted-foreground">
              عبارت را کوتاه‌تر کنید یا فیلتر دستگاه و دسته را پاک کنید.
            </p>
            <button
              className="mt-3 min-h-11 text-primary"
              onClick={() => update({ model: "", brand: "", category: "", favorites: false })}
            >
              نمایش بدون فیلتر دستگاه و دسته
            </button>
          </div>
        )}
        <ul className="space-y-3">
          {visible.map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                state={state}
                query={searching ? debouncedQuery : ""}
                hit={searching ? results.hits.find((hit) => hit.note.id === note.id) : undefined}
              />
            </li>
          ))}
        </ul>
        {visible.length < filtered.length && (
          <button
            onClick={() => update({ limit: (state.limit ?? 25) + 25 })}
            className="mt-4 min-h-12 w-full rounded-xl border border-border bg-card text-sm text-primary"
          >
            نمایش مطالب بیشتر
          </button>
        )}
      </main>
      <footer className="mt-8 border-t border-border pt-4">
        <LibraryBackup />
        <button
          onClick={() => setAdding(!adding)}
          aria-expanded={adding}
          className="min-h-12 w-full rounded-xl border border-primary text-sm font-bold text-primary"
        >
          افزودن یادداشت شخصی
        </button>
        {adding && <NoteEditor onClose={() => setAdding(false)} />}
      </footer>
    </div>
  );
}
