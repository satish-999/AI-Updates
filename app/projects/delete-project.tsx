"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DeleteProject({ id }: { id: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <><button disabled={busy} className="project-delete" onClick={async () => {
    if (!window.confirm("Delete this saved project?")) return;
    setBusy(true); setError("");
    try { const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); if (res.ok) router.refresh(); else setError("Could not delete this project."); } catch { setError("Connection failed."); } finally { setBusy(false); }
  }}>Delete project</button>{error && <span role="alert">{error}</span>}</>;
}
