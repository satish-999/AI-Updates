import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "../../nav";
import { getEntityPage } from "@/lib/db";
import { mmdd } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Everything about one company, person or model, chronologically.
 * This is the page that replaces Googling a name.
 */
export default async function EntityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { entity, stories } = await getEntityPage(slug);
  if (!entity) notFound();

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
        <span className="meta">{stories.length} stories</span>
      </header>
      <Nav />

      <h1 className="title">{entity.name}</h1>
      <ul className="chips">
        <li>{entity.kind}</li>
        <li>{stories.length} {stories.length === 1 ? "story" : "stories"}</li>
      </ul>

      {stories.length === 0 ? (
        <p className="empty">Nothing recorded yet.</p>
      ) : (
        <ol className="pulse">
          {stories.map((s) => (
            <li key={s.id}>
              <Link href={`/story/${s.id}`} className="story">
                <span className="rank">{mmdd(s.first_seen_at)}</span>
                <span>
                  <h2 className="headline">{s.one_liner ?? s.fallback_title}</h2>
                  <span className="byline">
                    {s.category && (
                      <span className="cat" style={{ ["--c" as string]: `var(--${s.category})` }}>
                        {s.category.replace(/_/g, " ")}
                      </span>
                    )}
                    {s.article_count > 1 && (
                      <>
                        <span className="dot">·</span>
                        <span className="count">{s.article_count} sources</span>
                      </>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
