import Link from "next/link";
import { authenticate } from "./actions";
export function AccountForm({ mode, error, notice }: { mode: "login" | "signup" | "recover"; error?: string; notice?: string }) {
  const ready = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_PUBLISHABLE_KEY;
  return <div className="login account-form"><Link href="/pricing" className="eyebrow">AI PULSE</Link><h1>{mode === "signup" ? "Your next idea starts here." : mode === "recover" ? "Reset your password" : "Welcome back."}</h1><p>{mode === "signup" ? "Create an account for your AI tools, projects and daily intelligence." : "Your AI workspace, on every device."}</p>
    {!ready && <p role="status">Account sign-in is being configured. Please check back soon.</p>}
    {error && <p role="alert">{error === "unconfigured" ? "Account sign-in is not available yet." : "We could not complete that request. Check your details, verify your email, or try again later."}</p>}
    {notice && <p role="status">{notice === "password" ? "Password updated. Sign in with your new password." : "If this address is eligible, an email is on its way. Check your inbox and spam folder."}</p>}
    <form action={authenticate}><input type="hidden" name="mode" value={mode} /><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>{mode !== "recover" && <label>Password<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={12} maxLength={128} /><small>Use at least 12 characters.</small></label>}<button disabled={!ready}>{mode === "signup" ? "Create account" : mode === "recover" ? "Send reset email" : "Sign in"}</button></form>
    {mode !== "recover" && process.env.GOOGLE_AUTH_ENABLED === "true" && <form action={authenticate}><input type="hidden" name="mode" value="google" /><button disabled={!ready}>Continue with Google</button></form>}
    <div className="account-links"><Link href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create an account" : "Back to sign in"}</Link>{mode === "login" && <Link href="/forgot-password">Forgot password?</Link>}</div><p className="small-copy">Read our <Link href="/privacy">privacy information</Link> and <Link href="/terms">service terms</Link>.</p>
  </div>;
}
