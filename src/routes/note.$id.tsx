import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { notes } from "@/data/notes";
import { Markdown } from "@/lib/markdown";

export const Route = createFileRoute("/note/$id")({
  loader: ({ params }) => {
    const note = notes.find((n) => n.id === params.id);
    if (!note) throw notFound();
    return note;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | راهنمای پکیج` },
          { name: "description", content: `${loaderData.title} — ${loaderData.category}` },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: `${loaderData.title} — راهنمای پکیج شوفاژ دیواری` },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary" },
        ]
      : [
          { title: "یافت نشد | راهنمای پکیج" },
          { name: "robots", content: "noindex" },
        ],
  }),
  component: NotePage,
});

function NotePage() {
  const note = Route.useLoaderData();

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          بازگشت به جستجو
        </Link>
      </header>

      <article className="pt-6">
        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
          {note.category}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug text-foreground">{note.title}</h1>

        {note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Markdown content={note.body} />
        </div>
      </article>

      <nav className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-muted-foreground">مطالب مرتبط</h2>
        <ul className="space-y-2">
          {notes
            .filter((n) => n.category === note.category && n.id !== note.id)
            .slice(0, 4)
            .map((n) => (
              <li key={n.id}>
                <Link
                  to="/note/$id"
                  params={{ id: n.id }}
                  className="block rounded-xl border border-border bg-card p-3.5 text-sm font-medium text-card-foreground active:bg-accent"
                >
                  {n.title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
