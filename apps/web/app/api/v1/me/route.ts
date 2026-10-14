import { ApiError, apiRoute, json } from "@/lib/server/api";
import { withRepositories } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ userId, timeZone }) => {
  const profile = await withRepositories(userId, (repos) => repos.users.profile());
  if (!profile) throw new ApiError(404, "Profile not found.");
  return json({
    id: userId,
    name: profile.name,
    email: profile.email,
    timeZone,
    onboarded: profile.preferences.onboardingCompleted === true,
  });
});
