import { SettingsForm } from "@/components/auth/SettingsForm";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { PlanSettings } from "@/components/settings/PlanSettings";
import { billingEnabled } from "@/lib/billing/plans";
import { googleConfigured } from "@/lib/auth/providers";
import { isRecentSignIn, signInMethods } from "@/lib/auth/reauth";
import { getCurrentUserId, getSession } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; billing?: string }>;
}) {
  const { error } = await searchParams;
  const id = await getCurrentUserId();
  const { profile, calendars } = await withRepositories(id, async (repos) => ({
    profile: await repos.users.profile(),
    calendars: await repos.calendar.feeds(),
  }));
  if (!profile) return null;
  const session = (await getSession())!;
  const methods = signInMethods(session);
  return (
    <div className="wrap auth-wrap">
      <header className="hero">
        <p className="eyebrow">Account</p>
        <h1>Settings</h1>
      </header>
      {searchParams && (await searchParams).billing === "success" && (
        <p className="notice" role="status">
          Welcome to Pro. It can take a few seconds to show here; refresh if it hasn’t.
        </p>
      )}
      <PlanSettings
        plan={profile.plan}
        status={profile.planStatus}
        renewsAt={profile.planRenewsAt?.toLocaleDateString("en-GB") ?? null}
        canBuy={billingEnabled()}
        hasBilling={!!profile.stripeCustomerId}
      />
      <SettingsForm
        timezone={profile.timezone}
        preferences={profile.preferences}
        email={profile.email}
        hasPassword={methods.hasPassword}
        googleEnabled={await googleConfigured()}
        googleLinked={methods.googleLinked}
        recentSignIn={isRecentSignIn(session.signedInAt)}
        linkError={error}
      />
      <CalendarSettings
        calendars={calendars.map((c) => ({ id: c.id, label: c.label, error: c.lastError }))}
      />
    </div>
  );
}
