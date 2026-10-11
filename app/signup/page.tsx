import { AccountForm } from "../login/form";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) { return <AccountForm mode="signup" {...await searchParams} />; }
