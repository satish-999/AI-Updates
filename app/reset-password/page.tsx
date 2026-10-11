import { requireIdentity } from "@/lib/identity";
import { changePassword } from "../login/actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireIdentity();
  return <div className="login"><h1>Choose a new password</h1>{(await searchParams).error && <p role="alert">Passwords must match and contain 12–128 characters. Please try again.</p>}<form action={changePassword}><label>New password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><button>Update password and sign out</button></form></div>;
}
