import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase";
export const dynamic = "force-dynamic";
async function confirm(form: FormData) {
  "use server";
  const token_hash = String(form.get("token_hash") ?? "");
  const type = form.get("type");
  let path = "/login?error=failed";
  try {
    if (token_hash && token_hash.length < 4096 && (type === "email" || type === "recovery")) {
      const { error } = await (await authClient()).auth.verifyOtp({ token_hash, type });
      if (!error) path = type === "recovery" ? "/reset-password" : "/";
    }
  } catch {}
  redirect(path);
}
export default async function Page({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  return <div className="login"><h1>{type === "recovery" ? "Reset your password" : "Confirm your email"}</h1><p>Continue to confirm this request. Links can only be used once.</p><form action={confirm}><input type="hidden" name="token_hash" value={token_hash ?? ""} /><input type="hidden" name="type" value={type ?? ""} /><button>Continue securely</button></form></div>;
}
