"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Nav() {
  const path = usePathname();
  return <nav className="product-nav" aria-label="Main navigation"><div className="primary-links">{[{ href: "/", label: "AI Updates" }, { href: "/news", label: "AI News" }, { href: "/advisor", label: "Find the Right AI" }].map(t => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}</div><details className="nav-more"><summary>Workspace</summary><div className="nav-menu"><Link href="/account">Account & subscription</Link><Link href="/pricing">Plans</Link><Link href="/monitors">Monitors</Link><Link href="/catchup">Catch-up</Link><Link href="/ask">Search & ask the archive</Link><Link href="/models">Model tracker</Link><Link href="/coverage">Source coverage</Link><form method="POST" action="/api/logout"><button type="submit">Sign out</button></form></div></details></nav>;
}
