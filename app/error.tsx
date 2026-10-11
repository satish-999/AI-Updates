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
        <h2>This page is temporarily unavailable</h2>
        <p>
          We could not load the requested information. Please try again shortly.
        </p>
        <button onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
