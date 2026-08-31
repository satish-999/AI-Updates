"use client";

import { useEffect } from "react";

/**
 * Marks the story read once it has been opened. Fire-and-forget: a failure
 * here must never break the page, it only means Catch-up shows it again.
 */
export function MarkRead({ storyId }: { storyId: number }) {
  useEffect(() => {
    fetch("/api/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId }),
      keepalive: true,
    }).catch(() => {});
  }, [storyId]);
  return null;
}
