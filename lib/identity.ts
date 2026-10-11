import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "./supabase";
import { COOKIE, VIEWER_COOKIE, verifyToken } from "./auth";

export type Identity = { id: string; email: string; preview: boolean };
export const identity = cache(async (): Promise<Identity | null> => {
  if (process.env.AUTH_MODE === "preview") {
    const jar = await cookies();
    const id = jar.get(VIEWER_COOKIE)?.value;
    const secret = process.env.AUTH_SECRET;
    if (id && /^[0-9a-f-]{36}$/i.test(id) && secret && process.env.APP_PASSWORD && await verifyToken(jar.get(COOKIE)?.value, secret)) return { id, email: "Local preview", preview: true };
    return null;
  }
  try {
    const { data: { user }, error } = await (await authClient()).auth.getUser();
    if (error || !user?.email_confirmed_at || !user.email) return null;
    return { id: user.id, email: user.email, preview: false };
  } catch { return null; }
});
export async function requireIdentity() {
  const user = await identity();
  if (!user) redirect("/login");
  return user;
}
