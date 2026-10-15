import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signInMethods } from "@/lib/auth/reauth";
import { entitlementsFor } from "@/lib/billing/plans";
import { isValidTimeZone } from "@/lib/domain/dates";
import { withRepositories } from "@/lib/repo";
import { deleteAccount, deletionSchema } from "@/lib/server/account-deletion";
import { ApiError, apiRoute, json, readJson, type ApiContext } from "@/lib/server/api";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

async function describe({ userId, timeZone }: ApiContext) {
  const [profile, session] = await Promise.all([
    withRepositories(userId, (repos) => repos.users.profile()),
    getSession(),
  ]);
  if (!profile || !session) throw new ApiError(404, "Profile not found.");
  const prefs = profile.preferences;
  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    timeZone,
    onboarded: prefs.onboardingCompleted === true,
    // Settings on the phone: the same preferences as the web's Settings page.
    preferences: {
      timeZone: prefs.timezoneSet === true ? profile.timezone : null,
      dayMinutes: typeof prefs.dayMinutes === "number" ? prefs.dayMinutes : 240,
      planMode: prefs.planMode === "scheduled" ? "scheduled" : "flexible",
      notifications: prefs.notifications === "off" ? "off" : "important",
    },
    // Deleting the account asks for the password when there is one.
    hasPassword: signInMethods(session).hasPassword,
    // Read-only on the phone: plans are bought and managed on the web.
    plan: {
      id: profile.plan,
      status: profile.planStatus,
      renewsAt: profile.planRenewsAt?.toISOString() ?? null,
      ...entitlementsFor(profile.plan),
    },
  };
}

export const GET = apiRoute(async (ctx) => json(await describe(ctx)));

const preferencesSchema = z
  .object({
    timeZone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
    dayMinutes: z.number().int().min(1).max(1440),
    planMode: z.enum(["flexible", "scheduled"]),
    notifications: z.enum(["off", "important"]),
  })
  .partial();

export const PATCH = apiRoute(async (ctx, request) => {
  const parsed = preferencesSchema.safeParse(await readJson(request));
  if (!parsed.success)
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid preferences.");
  const { timeZone, ...preferences } = parsed.data;
  await withRepositories(ctx.userId, (repos) =>
    repos.users.savePreferences(timeZone ?? ctx.profile.timezone, {
      ...preferences,
      ...(timeZone ? { timezoneSet: true } : {}),
    })
  );
  revalidatePath("/", "layout");
  return json(await describe({ ...ctx, timeZone: timeZone ?? ctx.timeZone }));
});

// Permanently delete the account and everything in it (app stores require
// this in-app). Same checks as the web's Settings: type DELETE, plus the
// password, or a recent Google sign-in for accounts without one.
export const DELETE = apiRoute(async (_ctx, request) => {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Unauthorized");
  const parsed = deletionSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Type DELETE to confirm.");
  const result = await deleteAccount(session, parsed.data);
  if (!result.ok) throw new ApiError(result.status, result.error);
  return json({ ok: true });
});
