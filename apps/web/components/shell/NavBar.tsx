"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon,
  FolderIcon,
  HomeIcon,
  HourglassIcon,
  InboxIcon,
  LogoMark,
  MoreIcon,
  RepeatIcon,
  SettingsIcon,
  SparkleIcon,
  TargetIcon,
  TimerIcon,
} from "./icons";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: HomeIcon },
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/goals", label: "Goals", icon: TargetIcon },
  { href: "/responsibilities", label: "Responsibilities", icon: RepeatIcon },
  { href: "/waiting", label: "Waiting on", icon: HourglassIcon },
  { href: "/focus", label: "Focus", icon: TimerIcon },
  { href: "/dump", label: "Brain Dump", icon: SparkleIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

// Phones get a bottom tab bar with the four daily areas; the rest live on /more.
const tab = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;
const TAB_ITEMS: NavItem[] = [
  tab("/"),
  tab("/inbox"),
  tab("/projects"),
  tab("/focus"),
  { href: "/more", label: "More", icon: MoreIcon },
];
const MORE_AREAS = ["/more", "/goals", "/responsibilities", "/dump", "/settings", "/reviews"];

const HIDDEN_ON = ["/signin", "/signup", "/reset", "/magic", "/privacy"];

function isActive(href: string, pathname: string | null) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_AREAS.some((area) => pathname?.startsWith(area));
  return !!pathname?.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="TaskMasterAi — Today">
      <LogoMark />
      <span className="brand-word">
        TaskMaster<span className="brand-accent">Ai</span>
      </span>
    </Link>
  );
}

/**
 * PRD_v2.md §2.5 main navigation, as the app shell: an espresso sidebar on
 * wide screens, a top brand bar plus bottom tab bar on phones.
 *
 * Not rendered on auth pages or /design — that's the styleguide, not an
 * app area — where children render without the shell.
 */
export function NavBar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname ?? "") || pathname?.startsWith("/design"))
    return <>{children}</>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="sidebar-nav" aria-label="Main">
          {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => (
            <Link
              key={href}
              href={href}
              className="sidebar-link"
              aria-current={isActive(href, pathname) ? "page" : undefined}
            >
              <ItemIcon />
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/dump" className="sidebar-promo">
          <span className="sidebar-promo-title">
            <SparkleIcon size={18} /> Brain Dump
          </span>
          <span className="sidebar-promo-text">
            Empty your head. AI turns it into tasks you review.
          </span>
          <span className="sidebar-promo-arrow" aria-hidden="true">
            <ArrowRightIcon size={16} />
          </span>
        </Link>
      </aside>

      <header className="mobile-bar">
        <Brand />
      </header>

      <main className="app-main">{children}</main>

      <nav className="tab-bar" aria-label="Main (compact)">
        {TAB_ITEMS.map(({ href, label, icon: ItemIcon }) => (
          <Link
            key={href}
            href={href}
            className="tab-link"
            aria-current={isActive(href, pathname) ? "page" : undefined}
          >
            <ItemIcon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
