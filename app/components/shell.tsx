import Link from "next/link";
import { Nav } from "../nav";
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="dashboard">
    <header className="masthead"><Link href="/updates" className="brand"><span className="brand-mark" aria-hidden="true">◈</span> AI Pulse<span className="brand-caption">THE AI INTELLIGENCE DESK</span></Link>
      <Link className="header-link" href="/catchup">Your catch-up ↗</Link></header>
    <Nav />
    <main id="main-content">{children}</main>
    <footer className="dashboard-footer"><span>AI Pulse · Understand what’s next.</span><Link href="/ask">Search the archive ↗</Link></footer>
  </div>;
}
