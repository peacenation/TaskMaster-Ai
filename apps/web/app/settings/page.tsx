import { SettingsForm } from "@/components/auth/SettingsForm";
import { googleConfigured } from "@/lib/auth/providers";
import { isRecentSignIn, signInMethods } from "@/lib/auth/reauth";
import { getCurrentUserId, getSession } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const id = await getCurrentUserId();
  const profile = await withRepositories(id, (repos) => repos.users.profile());
  if (!profile) return null;
  const session = (await getSession())!;
  const methods = signInMethods(session);
  return (
    <div className="wrap auth-wrap">
      <header className="hero">
        <p className="eyebrow">Account</p>
        <h1>Settings</h1>
      </header>
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
    </div>
  );
}
