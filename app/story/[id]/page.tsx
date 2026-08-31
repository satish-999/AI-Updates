import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "../../nav";
import { MarkRead } from "./mark-read";
import { AskStory } from "./ask-story";
import {
  getStory,
  getStoryArticles,
  getStoryEntities,
  getThreadStories,
} from "@/lib/db";
import { ymd, mmdd } from "@/lib/format";

// Per request, for the same reason as the Pulse: builds must not need a
// live database.
export const dynamic = "force-dynamic";

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
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
      </header>
      <Nav />
      <MarkRead storyId={storyId} />

      <h1 className="title">{story.one_liner ?? story.fallback_title}</h1>

      <ul className="chips">
        {story.category && <li>{story.category.replace(/_/g, " ")}</li>}
        <li>{story.article_count} {story.article_count === 1 ? "source" : "sources"}</li>
        <li>importance {story.importance.toFixed(2)}</li>
        {/* Entities are links: tapping a name is what replaces Googling it. */}
        {entities.map((e) => (
          <li key={e.id}>
            <Link href={`/entity/${e.slug}`}>{e.name}</Link>
          </li>
        ))}
      </ul>

      <h2 className="sec">
        {articles.length} {articles.length === 1 ? "source" : "sources"}
      </h2>
      <ul className="sources">
        {articles.map((a) => (
          <li key={a.id}>
            <div className="src-name">
              {a.source_name} · {ymd(a.published_at)}
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

      <AskStory storyId={storyId} />

      {/* The history that would otherwise need a search is just a foreign key. */}
      {thread.length > 0 && (
        <>
          <h2 className="sec">Earlier in {story.thread_title ?? "this thread"}</h2>
          <ol className="pulse">
            {thread.map((s) => (
              <li key={s.id}>
                <Link href={`/story/${s.id}`} className="story">
                  <span className="rank">{mmdd(s.first_seen_at)}</span>
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
