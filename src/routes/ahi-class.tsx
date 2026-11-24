import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Search, Wrench } from "lucide-react";
import { notes } from "@/data/notes";
import { useLibraryState } from "@/lib/library-hooks";
import { classGuides } from "@/data/class-guide-readings";

export const Route = createFileRoute("/ahi-class")({
  head: () => ({ meta: [{ title: "کلاس استاد آهی | راهنمای پکیج" }] }),
  component: ClassPage,
});

const category = "کلاس استاد آهی";
const topics = notes.filter((note) => note.category === category);
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
const lists = [
  {
    id: "faults",
    title: "عیب‌ها",
    items: topics.filter((note) => note.content?.kind === "symptom"),
  },
  {
    id: "parts",
    title: "قطعات",
    items: topics.filter((note) => note.content?.kind === "component"),
  },
];

function ClassPage() {
  const { data, error } = useLibraryState();
  const study = data?.study;
  const position = study?.position;
  const current = position && topicsById.get(position.id);
  const currentSection =
    current && current.content?.sections.find((item) => item.id === position?.section);
  const marks = (study?.marks ?? []).flatMap((mark) => {
    const topic = topicsById.get(mark.id);
    const section = topic?.content?.sections.find((item) => item.id === mark.section);
    return topic && section ? [{ topic, section }] : [];
  });
  const personal = (study?.notes ?? []).flatMap((note) => {
    const topic = topicsById.get(note.id);
    return topic ? [{ topic, body: note.body }] : [];
  });
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-5">
      <Link
        to="/"
        search={{}}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        راهنمای پکیج
      </Link>
      <h1 className="mt-5 text-3xl font-extrabold">کلاس استاد آهی</h1>
      <p className="mt-3 leading-8 text-muted-foreground">
        عیب‌ها، قطعات و مثال‌های کلاس تا پایان جلسهٔ ششم
      </p>
      <nav aria-label="مسیرهای مطالعه" className="mt-5 grid grid-cols-3 gap-2">
        {[
          { id: "faults", title: "عیب‌ها", icon: Search },
          { id: "parts", title: "قطعات", icon: Wrench },
          { id: "references", title: "متن کامل", icon: BookOpen },
        ].map(({ id, title, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-4 text-sm font-bold hover:bg-accent"
          >
            <Icon size={20} aria-hidden="true" className="text-primary" />
            {title}
          </a>
        ))}
      </nav>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/"
          search={{ category }}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          جست‌وجو در کلاس
        </Link>
        <Link
          to="/note/$id"
          params={{ id: "ahi-methods" }}
          search={{}}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm"
        >
          روش‌های تشخیص
        </Link>
      </div>

      <section aria-labelledby="class-diagnosis" className="mt-6">
        <h2 id="class-diagnosis" className="text-lg font-bold">
          عیب‌یابی با مثال‌های کلاس
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {classGuides.map((guide) => (
            <Link
              key={guide.id}
              to="/diagnose"
              search={{ guide: guide.id }}
              className="flex min-h-12 items-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-primary"
            >
              {guide.title}
            </Link>
          ))}
        </div>
      </section>

      <section
        className="mt-8 rounded-2xl border border-border bg-card p-4"
        aria-labelledby="my-study"
      >
        <h2 id="my-study" className="text-lg font-bold">
          مرور من
        </h2>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {current && (
          <Link
            to="/note/$id"
            params={{ id: current.id }}
            search={{}}
            hash={currentSection?.id ?? ""}
            className="mt-3 block rounded-xl bg-primary/10 p-3 text-sm leading-7 text-primary"
          >
            <span className="block font-bold">ادامهٔ مطالعه</span>
            {current.title}
            {currentSection && ` · ${currentSection.title}`}
          </Link>
        )}
        <details className="mt-2 border-b border-border">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            بخش‌های نشان‌شده ({marks.length})
          </summary>
          {marks.length === 0 && (
            <p className="pb-3 text-sm text-muted-foreground">
              با دکمهٔ نشان در هر بخش، آن را برای مرور ذخیره کن.
            </p>
          )}
          <ul className="space-y-2 pb-3">
            {marks.map(({ topic, section }) => (
              <li key={`${topic.id}#${section.id}`}>
                <Link
                  to="/note/$id"
                  params={{ id: topic.id }}
                  search={{}}
                  hash={section.id}
                  className="block rounded-lg bg-secondary p-3 text-sm leading-7"
                >
                  <span className="block font-bold">{section.title}</span>
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            یادداشت‌های شخصی ({personal.length})
          </summary>
          {personal.length === 0 && (
            <p className="text-sm text-muted-foreground">
              مثال‌ها و تجربه‌های خودت را کنار مطلب بنویس.
            </p>
          )}
          <ul className="space-y-2">
            {personal.map(({ topic, body }) => (
              <li key={topic.id}>
                <Link
                  to="/note/$id"
                  params={{ id: topic.id }}
                  search={{}}
                  hash="study-note"
                  className="block rounded-lg bg-secondary p-3 text-sm leading-7"
                >
                  <span className="block font-bold">{topic.title}</span>
                  <span className="line-clamp-2 whitespace-pre-wrap break-words">{body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section
        id="references"
        className="mt-8 scroll-mt-6 rounded-2xl border border-border bg-card p-4"
      >
        <h2 className="text-lg font-bold">متن کامل مرجع‌ها</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link
            to="/ahi-class/reference/$reference"
            params={{ reference: "faults" }}
            className="rounded-xl bg-secondary p-3 text-sm font-medium"
          >
            عیب‌ها و روش‌های عیب‌یابی
          </Link>
          <Link
            to="/ahi-class/reference/$reference"
            params={{ reference: "parts" }}
            className="rounded-xl bg-secondary p-3 text-sm font-medium"
          >
            قطعات و جزئیات
          </Link>
        </div>
      </section>
      {lists.map(({ id, title, items }) => (
        <section key={id} id={id} className="mt-8 scroll-mt-6">
          <h2 className="text-xl font-bold">{title}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((note) => (
              <li key={note.id} className="min-w-0">
                <Link
                  to="/note/$id"
                  params={{ id: note.id }}
                  search={{}}
                  className="flex h-full min-h-12 items-center rounded-xl border border-border bg-card px-3 py-2 text-sm leading-7 hover:bg-accent"
                >
                  {note.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
