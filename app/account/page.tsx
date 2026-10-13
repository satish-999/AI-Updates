import { requireAccount } from "@/lib/current-user";
import { Shell } from "../components/shell";
import { AccountSettings } from "./settings";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireAccount();
  return <Shell><h1>Your account</h1><p>Signed in as {user.username}.</p><AccountSettings username={user.username} /></Shell>;
}
