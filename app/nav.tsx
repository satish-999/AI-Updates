"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const TABS = [
  { href: "/updates", label: "AI Updates" },
  { href: "/news", label: "AI News" },
  { href: "/advisor", label: "Find the Right AI" },
];
export function Nav() {
  const path = usePathname();
  return <><nav className="tabs primary-tabs" aria-label="Main navigation">{TABS.map(t => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}<form method="POST" action="/api/logout"><button type="submit">Sign out</button></form></nav>
    <nav className="secondary-tabs" aria-label="Explore more">{[{href:"/projects",label:"My projects"},{href:"/pulse",label:"Top stories"},{href:"/catchup",label:"Catch-up"},{href:"/models",label:"Model board"},{href:"/ask",label:"Ask the archive"}].map(t => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}</nav></>;
}
