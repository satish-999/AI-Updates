import { AccountForm } from "./form";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  if (process.env.AUTH_MODE === "preview") return <div className="login"><h1>AI Pulse preview</h1><p>Local preview only. No customer account is created.</p><form method="POST" action="/api/login"><input type="password" name="password" aria-label="Preview password" required /><button>Open preview</button></form>{params.error && <p role="alert">Check the preview password.</p>}<a href="/signup">Preview account registration</a></div>;
  return <AccountForm mode="login" {...params} />;
}
