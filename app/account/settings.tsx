"use client";
import { useState } from "react";
import Link from "next/link";
export function AccountSettings({ username }: { username: string }) {
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setBusy(true); setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), action }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Please try again."); return; }
      form.reset();
      if (data.recoveryCode) setCode(data.recoveryCode);
      else window.location.assign("/signup");
    } catch { setError("Unable to connect. Please try again."); } finally { setBusy(false); }
  }
  if (code) return <section className="note"><h2>Password changed</h2><p>All devices are signed out. Save this replacement recovery code privately; your previous code no longer works.</p><pre className="starter-prompt">{code}</pre><Link href="/login">I saved my code — sign in</Link></section>;
  return <div className="account-entry"><section><h2>Change password</h2><p>This signs out all devices and replaces your recovery code.</p><form onSubmit={event => submit(event, "password")}>
    <label>Current password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" /></label>
    <label>New password<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    <button disabled={busy} className="primary-button">Change password</button></form></section>
    <section><h2>Delete account</h2><p>Permanently deletes your account, saved projects and reading history. This cannot be undone.</p><form onSubmit={event => submit(event, "delete")}>
    <label>Type {username} to confirm<input name="confirmation" required autoComplete="off" /></label>
    <label>Current password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" /></label>
    <button disabled={busy}>Permanently delete my account</button></form></section>
    {error && <p role="alert" className="err">{error}</p>}</div>;
}
