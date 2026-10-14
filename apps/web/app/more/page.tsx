import Link from "next/link";
import { SignOut } from "@/components/auth/SignOut";
import {
  ArrowRightIcon,
  CalendarIcon,
  RepeatIcon,
  SettingsIcon,
  SparkleIcon,
  TargetIcon,
} from "@/components/shell/icons";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// The phone tab bar's overflow: every area that isn't one of its four tabs.
const AREAS = [
  {
    href: "/dump",
    label: "Brain Dump",
    hint: "Empty your head; review what AI organises",
    icon: SparkleIcon,
  },
  { href: "/goals", label: "Goals", hint: "What the work is for", icon: TargetIcon },
  {
    href: "/responsibilities",
    label: "Responsibilities",
    hint: "Recurring work",
    icon: RepeatIcon,
  },
  {
    href: "/reviews/daily",
    label: "Daily review",
    hint: "Close out today",
    icon: CalendarIcon,
  },
  {
    href: "/reviews/weekly",
    label: "Weekly review",
    hint: "Look back, plan ahead",
    icon: CalendarIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    hint: "Account, time zone and planning",
    icon: SettingsIcon,
  },
];

export default async function MorePage() {
  await getCurrentUserId();
  return (
    <div className="wrap">
      <header className="hero">
        <h1>More</h1>
      </header>
      <ul className="menu-list">
        {AREAS.map(({ href, label, hint, icon: AreaIcon }) => (
          <li key={href}>
            <Link href={href} className="menu-link">
              <span className="icon-tile">
                <AreaIcon />
              </span>
              <span className="menu-link-text">
                <strong>{label}</strong>
                <span className="field-hint">{hint}</span>
              </span>
              <ArrowRightIcon size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="button-row" style={{ marginTop: "2rem" }}>
        <SignOut />
      </div>
    </div>
  );
}
