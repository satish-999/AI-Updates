import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStory,
  getStoryArticles,
  getStoryEntities,
  getThreadStories,
} from "@/lib/db";

export const revalidate = 60;

function day(iso: string | null): string {
  if (!iso) return "undated";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) notFound();

  const story = await getStory(storyId);
  if (!story) notFound();

  const [articles, entities, thread] = await Promise.all([
    getStoryArticles(storyId),
    getStoryEntities(storyId),
    story.thread_id ? getThreadStories(story.thread_id, storyId) : Promise.resolve([]),
  ]);

  return (
    <div className="wrap">
      <Link href="/" className="back">&larr; Pulse</Link>

      <h1 className="title">{story.one_liner ?? story.fallback_title}</h1>

      <ul className="chips">
        {story.category && <li>{story.category.replace(/_/g, " ")}</li>}
        <li>{story.article_count} {story.article_count === 1 ? "source" : "sources"}</li>
        <li>importance {story.importance.toFixed(2)}</li>
        {entities.map((e) => (
          <li key={e.id}>{e.name}</li>
        ))}
      </ul>

      <h2 className="sec">
        {articles.length} {articles.length === 1 ? "source" : "sources"}
      </h2>
      <ul className="sources">
        {articles.map((a) => (
          <li key={a.id}>
            <div className="src-name">
              {a.source_name} · {day(a.published_at)}
            </div>
            <a
              className="src-title"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.title}
            </a>
            {a.summary && <p className="src-summary">{a.summary.slice(0, 260)}</p>}
          </li>
        ))}
      </ul>

      {/* The history that would otherwise need a search is just a foreign key. */}
      {thread.length > 0 && (
        <>
          <h2 className="sec">Earlier in {story.thread_title ?? "this thread"}</h2>
          <ol className="pulse">
            {thread.map((s) => (
              <li key={s.id}>
                <Link href={`/story/${s.id}`} className="story">
                  <span className="rank">{day(s.first_seen_at).slice(5)}</span>
                  <span>
                    <h2 className="headline">{s.one_liner ?? s.fallback_title}</h2>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
