"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/projects", label: "Projects" },
  { href: "/goals", label: "Goals" },
  { href: "/responsibilities", label: "Responsibilities" },
  { href: "/focus", label: "Focus" },
  { href: "/settings", label: "Settings" },
];

/**
 * PRD_v2.md §2.5 main navigation. Shell only — Today (`/`) is the only
 * area with real content right now (the Phase 5-7 prototype, built early
 * and out of order; see IMPLEMENTATION_PLAN.md's progress checkpoints).
 * The rest are placeholder stubs until their phase is reached.
 *
 * Not rendered on /design — that's the styleguide, not an app area.
 */
export function NavBar() {
  const pathname = usePathname();
  if (
    ["/signin", "/signup", "/reset", "/magic", "/privacy"].includes(pathname) ||
    pathname?.startsWith("/design")
  )
    return null;

  return (
    <nav className="app-nav" aria-label="Main">
      <div className="app-nav-inner">
        <span className="app-nav-brand">TaskMaster</span>
        <div className="app-nav-links">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="app-nav-link"
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
