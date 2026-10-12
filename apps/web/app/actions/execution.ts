"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import {
  changeStatus,
  executionStatusSchema,
  breakdownInputSchema,
  commitBreakdown,
  recoveryInputSchema,
  recover,
} from "@/lib/execution/operations";
import { buildToday, todaySettingsSchema } from "@/lib/planning/today";
import { toPlannable } from "@/lib/server/views";
import { localDate } from "@/lib/execution/date";
export type ExecutionResult = { ok: true } | { ok: false; message: string };
export async function actOnTask(id: string, status: unknown): Promise<ExecutionResult> {
  const taskId = z.string().uuid().safeParse(id);
  const next = executionStatusSchema.safeParse(status);
  if (!taskId.success || !next.success) return { ok: false, message: "Invalid task action." };
  const userId = await getCurrentUserId();
  try {
    await withRepositories(userId, (repos) =>
      changeStatus(repos, taskId.data, next.data, new Date())
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Could not save your decision. The task is unchanged — retry.",
    };
  }
}
export async function saveBreakdown(input: unknown): Promise<ExecutionResult> {
  const parsed = breakdownInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the step titles and estimates." };
  const userId = await getCurrentUserId();
  try {
    await withRepositories(userId, (repos) => commitBreakdown(repos, parsed.data));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Could not save the steps. They may already exist; refresh or retry.",
    };
  }
}
export async function saveRecovery(input: unknown): Promise<ExecutionResult> {
  const parsed = recoveryInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Choose what should happen to each item." };
  const userId = await getCurrentUserId();
  try {
    await withRepositories(userId, (repos) => recover(repos, parsed.data, new Date()));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Could not save recovery decisions. Your selections are still here — retry.",
    };
  }
}
export async function rebuildPlan(
  _previous: { message?: string },
  form: FormData
): Promise<{ message?: string }> {
  const settings = todaySettingsSchema.parse(Object.fromEntries(form));
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const now = new Date();
  try {
    await withRepositories(userId, async (repos) => {
      if ((await repos.execution.recovery(now)).length) throw new Error("recovery");
      const today = buildToday(
        toPlannable(await repos.tasks.list(), await repos.tasks.dependencies()),
        {
          now,
          timeZone,
          availableMinutes: settings.availableMinutes,
          energy: settings.energy,
        },
        settings.dayMinutes,
        await repos.users.nextTaskId()
      );
      await repos.users.savePreferences(timeZone, {
        dayMinutes: settings.dayMinutes,
        availableMinutes: settings.availableMinutes ?? null,
        energy: settings.energy ?? null,
      });
      await repos.execution.savePlan(localDate(now, timeZone), today.plan, true);
    });
  } catch {
    return {
      message:
        "Review missed work below before rebuilding. If there is no missed work, try again.",
    };
  }
  revalidatePath("/");
  redirect("/");
}
