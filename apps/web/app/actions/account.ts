"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/domain/dates";
import { getCurrentUserId } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
// Each Settings page saves only the fields it shows; the rest keep their
// values.
const preferencesSchema = z.object({
  timezone: z
    .string()
    .refine(isValidTimeZone, "Choose a valid IANA timezone, e.g. Europe/London.")
    .optional(),
  dayMinutes: z.coerce
    .number()
    .int()
    .min(1, "Set at least a few minutes of daily availability.")
    .max(1440, "A day has 24 hours at most.")
    .optional(),
  planMode: z.enum(["flexible", "scheduled"]).optional(),
  notifications: z.enum(["off", "important"]).optional(),
});
export async function savePreferences(
  _previous: { message?: string },
  form: FormData
): Promise<{ message?: string }> {
  const parsed = preferencesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const userId = await getCurrentUserId();
  try {
    const { timezone, ...chosen } = parsed.data;
    const preferences = Object.fromEntries(
      Object.entries(chosen).filter(([, value]) => value !== undefined)
    );
    await withRepositories(userId, async (repos) => {
      const current = (await repos.users.profile())?.timezone ?? "UTC";
      await repos.users.savePreferences(
        timezone ?? current,
        timezone ? { ...preferences, timezoneSet: true } : preferences
      );
    });
    revalidatePath("/", "layout");
    return { message: "Preferences saved." };
  } catch {
    return { message: "Could not save preferences. Try again." };
  }
}
export async function finishOnboarding() {
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) =>
    repos.users.savePreferences((await repos.users.profile())?.timezone ?? "UTC", {
      onboardingCompleted: true,
    })
  );
  revalidatePath("/");
  redirect("/");
}
