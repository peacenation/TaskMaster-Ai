import Link from "next/link";
import type { ComponentType } from "react";
import { SignOut } from "@/components/auth/SignOut";
import {
  BellIcon,
  CalendarIcon,
  DatabaseIcon,
  LockIcon,
  UserIcon,
} from "@/components/shell/icons";
import { SETTINGS_SECTIONS, settingsHref, type SettingsSection } from "./sections";

const ICONS: Record<SettingsSection, ComponentType<{ size?: number }>> = {
  profile: UserIcon,
  planning: CalendarIcon,
  notifications: BellIcon,
  calendar: CalendarIcon,
  security: LockIcon,
  data: DatabaseIcon,
};

// The list of Settings sections, with Sign out at the foot.
export function SettingsNav({ active }: { active: SettingsSection }) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      <p className="settings-nav-title">Personal settings</p>
      <ul>
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          return (
            <li key={section.id}>
              <Link
                href={settingsHref(section.id)}
                className="settings-nav-link"
                aria-current={section.id === active ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{section.label}</span>
                {"soon" in section && section.soon && (
                  <span className="settings-pill">Coming soon</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="settings-nav-foot">
        <SignOut className="settings-sign-out" withIcon />
      </div>
    </nav>
  );
}
