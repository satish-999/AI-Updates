"use server";
import { redirect } from "next/navigation";
import { authClient, appOrigin } from "@/lib/supabase";

export async function authenticate(form: FormData) {
  const mode = String(form.get("mode"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const path = mode === "signup" ? "/signup" : mode === "recover" ? "/forgot-password" : "/login";
  let destination = path + "?error=failed";
  try {
    const client = await authClient();
    if (mode === "google") {
      if (process.env.GOOGLE_AUTH_ENABLED !== "true") throw new Error("Disabled");
      const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appOrigin() + "/auth/callback" } });
      if (!error && data.url) destination = data.url;
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Invalid email");
      if (mode !== "recover" && (password.length < 12 || password.length > 128)) throw new Error("Invalid password");
      if (mode === "signup") {
        const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: appOrigin() + "/auth/callback" } });
        if (!error) destination = "/login?notice=verify";
      } else if (mode === "recover") {
        // Identical response for existing and unknown addresses.
        await client.auth.resetPasswordForEmail(email, { redirectTo: appOrigin() + "/auth/callback?next=reset" });
        destination = "/forgot-password?notice=sent";
      } else if (mode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (!error && data.user?.email_confirmed_at) destination = "/";
      }
    }
  } catch {}
  redirect(destination);
}
export async function changePassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  let done = false;
  if (password.length >= 12 && password.length <= 128 && password === form.get("confirmation")) {
    try {
      const client = await authClient();
      const { data: { user } } = await client.auth.getUser();
      if (user?.email_confirmed_at) {
        const { error } = await client.auth.updateUser({ password });
        if (!error) { await client.auth.signOut({ scope: "global" }); done = true; }
      }
    } catch {}
  }
  redirect(done ? "/login?notice=password" : "/reset-password?error=failed");
}
