import { Shell } from "../components/shell";
import { Advisor } from "./advisor";
import catalog from "@/data/catalog.json";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Shell><section className="advisor-hero"><p className="eyebrow">LESS SEARCHING. MORE CREATING.</p><h1>What do you<br /><em>want to make?</em></h1><p className="hero-copy">Find a practical starting point for anime, video, audio and graphics. Compare free routes and paid plans, with sources attached.</p></section><Advisor plans={catalog} /></Shell>;
}
