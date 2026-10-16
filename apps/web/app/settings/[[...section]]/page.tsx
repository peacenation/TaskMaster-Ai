import Link from "next/link";
import { notFound } from "next/navigation";
import { SignOut } from "@/components/auth/SignOut";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { DeleteAccount, SignInMethods } from "@/components/settings/AccountSecurity";
import { AccountCard, PlanSettings, SettingsTip } from "@/components/settings/PlanSettings";
import { PreferencesForm, type Preferences } from "@/components/settings/PreferencesForm";
import { SettingsNav } from "@/components/settings/SettingsNav";
import {
  SETTINGS_SECTIONS,
  isSettingsSection,
  type SettingsSection,
} from "@/components/settings/sections";
import { billingEnabled } from "@/lib/billing/plans";
import { googleConfigured } from "@/lib/auth/providers";
import { isRecentSignIn, signInMethods } from "@/lib/auth/reauth";
import { getCurrentUserId, getSession } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";

export const dynamic = "force-dynamic";

const TIPS: Record<SettingsSection, { title: string; body: string }> = {
  profile: {
    title: "Your data stays yours",
    body: "Export everything at any time from Data & privacy.",
  },
  planning: {
    title: "A plan that fits your day",
    body: "Set realistic availability so your daily plan leaves room to breathe.",
  },
  notifications: {
    title: "Reminders on your phone",
    body: "The TaskMasterAi app nudges you before each planned block and meeting.",
  },
  calendar: {
    title: "Meetings come first",
    body: "Connected calendars take meeting time out of your day before work is planned.",
  },
  security: {
    title: "Two ways in",
    body: "Connect Google as well as a password, so you can always sign in.",
  },
  data: {
    title: "Nothing hidden",
    body: "Your export includes every task, Brain Dump, plan, project and goal.",
  },
};

function timezones(current: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes(current) ? zones : [current, ...zones];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ error?: string; billing?: string }>;
}) {
  const { section: path } = await params;
  const { error, billing } = await searchParams;
  const requested = path?.[0] ?? "planning";
  if (
    (path && path.length > 1) ||
    !isSettingsSection(requested) ||
    (requested === "planning" && path)
  )
    notFound();
  const section: SettingsSection = requested;

  const id = await getCurrentUserId();
  const { profile, calendars } = await withRepositories(id, async (repos) => ({
    profile: await repos.users.profile(),
    calendars: await repos.calendar.feeds(),
  }));
  if (!profile) return null;
  const session = (await getSession())!;
  const methods = signInMethods(session);
  const prefs = profile.preferences;
  const initial: Preferences = {
    timezone: profile.timezone,
    dayMinutes: Number(prefs.dayMinutes) || 240,
    planMode: prefs.planMode === "scheduled" ? "scheduled" : "flexible",
    notifications: prefs.notifications === "important" ? "important" : "off",
  };
  const calendarCard = (
    <CalendarSettings
      calendars={calendars.map((c) => ({ id: c.id, label: c.label, error: c.lastError }))}
    />
  );
  const title = SETTINGS_SECTIONS.find((s) => s.id === section)!.label;

  return (
    <div className="wrap settings">
      <header className="settings-head">
        <h1>Settings</h1>
        <p>Make TaskMasterAi work your way.</p>
      </header>
      {billing === "success" && (
        <p className="notice" role="status">
          Welcome to Pro. It can take a few seconds to show here; refresh if it hasn’t.
        </p>
      )}
      <div className="settings-layout">
        <SettingsNav active={section} />

        <div className="settings-main">
          <h2 id="settings-section-heading" className="settings-title">
            {title}
          </h2>

          {section === "planning" && (
            <PreferencesForm
              initial={initial}
              timezones={timezones(profile.timezone)}
              calendar={calendarCard}
            />
          )}

          {section === "notifications" && (
            <PreferencesForm initial={initial} timezones={[]} only="notifications" />
          )}

          {section === "calendar" && calendarCard}

          {section === "profile" && (
            <section className="settings-card" aria-labelledby="profile-heading">
              <h3 id="profile-heading">Profile</h3>
              <dl className="settings-facts">
                <div>
                  <dt>Name</dt>
                  <dd>{profile.name || "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>
                    {profile.timezone.replaceAll("_", " ")} ·{" "}
                    <Link href="/settings">Change</Link>
                  </dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>
                    {profile.plan === "pro" ? "Pro" : "Free"} ·{" "}
                    <Link href="/pricing">Compare plans</Link>
                  </dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>
                    {profile.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
              <p className="field-hint">
                Sign-in options are under{" "}
                <Link href="/settings/security">Security &amp; sign-in</Link>.
              </p>
            </section>
          )}

          {section === "security" && (
            <>
              <SignInMethods
                hasPassword={methods.hasPassword}
                googleEnabled={await googleConfigured()}
                googleLinked={methods.googleLinked}
                linkError={error}
              />
              {/* On wide screens Sign out is at the foot of the section list. */}
              <section
                className="settings-card settings-narrow-only"
                aria-labelledby="session-heading"
              >
                <h3 id="session-heading">Session</h3>
                <p className="settings-card-lede">Sign out of TaskMasterAi on this device.</p>
                <SignOut withIcon />
              </section>
            </>
          )}

          {section === "data" && (
            <>
              <section className="settings-card" aria-labelledby="export-heading">
                <h3 id="export-heading">Your data</h3>
                <p className="settings-card-lede">
                  Download everything TaskMasterAi stores about you, as JSON.
                </p>
                <div className="settings-side-actions">
                  <a href="/api/account/export" className="btn btn-secondary">
                    Export my data
                  </a>
                  <Link className="settings-link" href="/privacy">
                    What TaskMaster stores and where AI is used
                  </Link>
                </div>
              </section>
              <DeleteAccount
                hasPassword={methods.hasPassword}
                recentSignIn={isRecentSignIn(session.signedInAt)}
                linkError={error}
              />
            </>
          )}
        </div>

        <div className="settings-side">
          <AccountCard
            name={profile.name}
            email={profile.email}
            googleLinked={methods.googleLinked}
          />
          <PlanSettings
            plan={profile.plan}
            status={profile.planStatus}
            renewsAt={profile.planRenewsAt?.toLocaleDateString("en-GB") ?? null}
            canBuy={billingEnabled()}
            hasBilling={!!profile.stripeCustomerId}
          />
          <SettingsTip {...TIPS[section]} />
        </div>
      </div>
    </div>
  );
}
