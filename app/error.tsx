"use client";

/**
 * Anything thrown in a page lands here. The most likely cause by far is Neon
 * being unreachable or an unset DATABASE_URL, so the copy names that rather
 * than showing a stack trace.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap">
      <div className="state">
        <h2>Something broke loading this page</h2>
        <p>
          Usually the database is unreachable or an environment variable is
          missing. The pipeline keeps collecting either way — nothing is lost.
        </p>
        <button onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
