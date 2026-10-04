"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/domain/dates";
import { getCurrentUserId } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
const preferencesSchema = z.object({
  timezone: z
    .string()
    .refine(isValidTimeZone, "Choose a valid IANA timezone, e.g. Europe/London."),
  dayMinutes: z.coerce.number().int().min(1).max(1440),
  planMode: z.enum(["flexible", "scheduled"]),
  notifications: z.enum(["off", "important"]),
});
export async function savePreferences(
  _previous: { message?: string },
  form: FormData
): Promise<{ message?: string }> {
  const parsed = preferencesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const userId = await getCurrentUserId();
  try {
    const { timezone, ...preferences } = parsed.data;
    await withRepositories(userId, (repos) =>
      repos.users.savePreferences(timezone, { ...preferences, timezoneSet: true })
    );
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
