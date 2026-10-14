import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark, SparkleIcon, TargetIcon, CalendarIcon } from "@/components/shell/icons";

const POINTS = [
  { icon: SparkleIcon, text: "Empty your head — AI turns it into tasks you review." },
  { icon: TargetIcon, text: "One clear next action, with the reasons shown." },
  { icon: CalendarIcon, text: "A realistic plan that says plainly when it won't fit." },
];

/** Decorative sun-over-hills, the same motif as Today's hero. */
function Hills() {
  return (
    <svg className="auth-hills" viewBox="0 0 400 180" aria-hidden="true" focusable="false">
      <circle cx="290" cy="56" r="26" fill="#c28b58" opacity="0.85" />
      <path
        d="M0 180 C70 110 150 96 220 126 S350 80 400 92 V180Z"
        fill="#c28b58"
        opacity="0.22"
      />
      <path
        d="M40 180 C130 130 220 138 280 150 S370 126 400 132 V180Z"
        fill="#c28b58"
        opacity="0.32"
      />
    </svg>
  );
}

/**
 * Sign-in, sign-up, reset and magic-link pages: an espresso brand panel
 * beside the form on wide screens, a compact brand header on phones.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <aside className="auth-panel">
        <Link href="/signin" className="brand auth-brand" aria-label="TaskMasterAi">
          <LogoMark size={36} />
          <span className="brand-word">
            TaskMaster<span className="brand-accent">Ai</span>
          </span>
        </Link>
        <div className="auth-panel-body">
          <p className="auth-panel-title">Clarity. Momentum. Done.</p>
          <ul className="auth-points">
            {POINTS.map(({ icon: PointIcon, text }) => (
              <li key={text}>
                <span className="auth-point-icon">
                  <PointIcon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <Hills />
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <header className="auth-head">
            <h1>{title}</h1>
            {subtitle && <p className="auth-sub">{subtitle}</p>}
          </header>
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </main>
    </div>
  );
}
