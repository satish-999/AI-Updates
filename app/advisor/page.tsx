import { Shell } from "../shell";
import { Advisor } from "./advisor";
export const dynamic = "force-dynamic";
import { requireIdentity } from "@/lib/identity";
export default async function AdvisorPage() {
  const user = await requireIdentity(); return <Shell><section className="page-heading"><p className="eyebrow">Start with your goal</p><h1>What would you like to create?</h1><p>Choose tools with evidence. Start free when you can. Pay when the limits justify it.</p></section><Advisor preview={user.preview} /></Shell>;
}
