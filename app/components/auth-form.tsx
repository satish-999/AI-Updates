"use client";
import Link from "next/link";
import { useState } from "react";
export function AuthForm({ mode }: { mode: "login" | "signup" | "recover" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const title = mode === "signup" ? "Create your account" : mode === "recover" ? "Recover your account" : "Welcome back";
  return <main className="account-entry"><Link href="/" className="brand">◈ AI Pulse</Link><h1>{title}</h1>
    <p>Your AI updates, creative guidance and projects in one place.</p>
    {code ? <section className="note"><h2>Save your recovery code</h2><p>Store this privately in your password manager. It replaces any previous code and can reset your password. We cannot email a replacement.</p><pre className="starter-prompt">{code}</pre><Link href={mode === "signup" ? "/updates" : "/login"}>I have saved my code — continue →</Link></section> : <form onSubmit={async e => {
      e.preventDefault(); setError(""); setBusy(true);
      const values = Object.fromEntries(new FormData(e.currentTarget));
      try {
        const response = await fetch(`/api/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const data = await response.json();
        if (!response.ok) { setError(data.error ?? "Please try again."); return; }
        if (data.recoveryCode) setCode(data.recoveryCode);
        else window.location.assign("/updates");
      } catch { setError("Unable to connect. Please try again."); } finally { setBusy(false); }
    }}>
      <label>Username<input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z][A-Za-z0-9_]{2,29}" autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
      <span className="small-copy">3–30 letters, numbers or underscores. Start with a letter. Not an email address.</span>
      {mode === "recover" && <label>Recovery code<input name="recoveryCode" required minLength={64} maxLength={64} autoComplete="off" spellCheck={false} /></label>}
      <label>{mode === "recover" ? "New password" : "Password"}<input type="password" name="password" required minLength={12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
      <span className="small-copy">Use a unique password of 12–128 characters.</span>
      <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "recover" ? "Reset password" : "Sign in"}</button>
    </form>}
    {error && <p role="alert" className="err">{error}</p>}
    {!code && <nav className="account-links">{mode !== "login" && <Link href="/login">Sign in</Link>}{mode !== "signup" && <Link href="/signup">Create account</Link>}{mode !== "recover" && <Link href="/recover">Forgot password?</Link>}</nav>}
    <p className="small-copy">The first release uses usernames and recovery codes. Email and Google sign-in are not enabled. Save your recovery code when you create your account.</p>
  </main>;
}
