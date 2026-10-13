import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "./auth";
import { sessionAccount } from "./accounts";
export async function requireAccount() {
  const user = await sessionAccount((await cookies()).get(COOKIE)?.value);
  if (!user) redirect("/login");
  return user;
}
