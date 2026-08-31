"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Pulse" },
  { href: "/catchup", label: "Catch-up" },
  { href: "/ask", label: "Ask" },
  { href: "/models", label: "Models" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={path === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
      <form method="POST" action="/api/logout">
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
