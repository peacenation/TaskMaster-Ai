import { SettingsForm } from "@/components/auth/SettingsForm";
import { getCurrentUserId } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
export const dynamic = "force-dynamic";
export default async function Page() {
  const id = await getCurrentUserId();
  const profile = await withRepositories(id, (repos) => repos.users.profile());
  if (!profile) return null;
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
      />
    </div>
  );
}
