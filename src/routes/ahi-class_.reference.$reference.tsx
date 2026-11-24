import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { notes } from "@/data/notes";
import coverage from "../../content/generated/ahi-class-coverage.json";
import { Markdown } from "@/lib/markdown";

const references = {
  faults: { title: "مرجع کامل عیب‌ها و روش‌های عیب‌یابی", page: "ahi-reference-faults" },
  parts: { title: "مرجع کامل قطعات و جزئیات", page: "ahi-reference-parts" },
};

const topics = new Map(notes.map((note) => [`/note/${note.id}`, note]));

export const Route = createFileRoute("/ahi-class_/reference/$reference")({
  loader: ({ params }) => {
    if (params.reference !== "faults" && params.reference !== "parts") throw notFound();
    return params.reference;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? references[loaderData].title : "مرجع کلاس استاد آهی" }],
  }),
  component: ClassReferencePage,
});

function ClassReferencePage() {
  const reference = references[Route.useLoaderData()];
  const file = topics.get(`/note/${reference.page}`)?.content?.sources[0]?.path;
  const sections = coverage.filter((row) => row.file === file);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
        <Link
          to="/ahi-class"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
        >
          بازگشت به کلاس
        </Link>
        <a href="#reference-top" className="inline-flex min-h-11 items-center text-sm text-primary">
          ابتدای مرجع
        </a>
      </header>
      <h1 id="reference-top" className="mt-6 scroll-mt-20 text-2xl font-extrabold leading-relaxed">
        {reference.title}
      </h1>
      <div className="mt-5 space-y-5">
        {sections.map((row, index) => {
          const [path, id] = row.destination.split("#");
          const topic = topics.get(path!);
          const section = topic?.content?.sections.find((entry) => entry.id === id);
          if (!topic || !section) return null;
          const isCase = /^[dp]\d{2}$/.test(section.id);
          return (
            <section
              key={row.destination}
              id={id}
              className="scroll-mt-20 rounded-xl border border-border bg-card p-4"
            >
              {index > 0 && <h2 className="mb-3 text-lg font-bold">{row.section}</h2>}
              {isCase && (
                <Link
                  to="/note/$id"
                  params={{ id: topic.id }}
                  search={{}}
                  hash={section.id}
                  className="mb-3 inline-flex min-h-11 items-center text-sm text-primary underline"
                >
                  صفحهٔ موضوع و مطالب مرتبط
                </Link>
              )}
              {section.body !== "عنوان گروه پرونده‌ها در مرجع کلاس." && (
                <Markdown
                  content={section.body.replace(/\]\(\/note\/ahi-[\w-]+#([dp]\d{2})\)/g, "](#$1)")}
                />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
