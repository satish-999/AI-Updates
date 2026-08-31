import Link from "next/link";
import { Nav } from "../nav";
import { cookies } from "next/headers";
import { getCatchup } from "@/lib/db";
import { VIEWER_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** What mattered that you have not opened yet — not an unread counter. */
export default async function Catchup() {
  // Read state is per browser, so two people sharing the password each get
  // their own Catch-up rather than clearing it for one another.
  const viewer = (await cookies()).get(VIEWER_COOKIE)?.value ?? "anonymous";
  const stories = await getCatchup(viewer, 10);

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
        <span className="meta">{stories.length} unread</span>
      </header>
      <Nav />

      {stories.length === 0 ? (
        <div className="state">
          <h2>All caught up</h2>
          <p>You have opened everything ranked so far. New stories appear as the pipeline runs.</p>
          <Link href="/">Back to the Pulse</Link>
        </div>
      ) : (
        <>
          <p className="hint">
            The {stories.length} highest-ranked {stories.length === 1 ? "story" : "stories"} you
            have not opened. Opening one marks it read.
          </p>
          <ol className="pulse">
            {stories.map((s, i) => (
              <li key={s.id}>
                <Link href={`/story/${s.id}`} className="story">
                  <span className="rank">{String(i + 1).padStart(2, "0")}</span>
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
        </>
      )}
    </div>
  );
}
