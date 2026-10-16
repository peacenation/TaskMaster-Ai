// Settings is split into sections, each at its own address
// (/settings/<id>); Planning preferences is /settings itself.
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile & account" },
  { id: "planning", label: "Planning preferences" },
  { id: "notifications", label: "Notifications", soon: true },
  { id: "calendar", label: "Calendar connections" },
  { id: "security", label: "Security & sign-in" },
  { id: "data", label: "Data & privacy" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

export function settingsHref(section: SettingsSection): string {
  return section === "planning" ? "/settings" : `/settings/${section}`;
}

export function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}
