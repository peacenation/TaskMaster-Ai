"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  commitInputSchema,
  commitReviewedItems,
  type CommitSummary,
} from "@/lib/capture/commit";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

// Server actions for capture. Inputs come from the browser, so every one
// is validated here — the system boundary — before touching storage.

const rawTextSchema = z.string().trim().min(1).max(20_000);

/** Saves the raw Brain Dump *before* any processing (PRD §1.11 Recoverability). */
export async function saveBrainDump(rawText: string): Promise<{ id: string }> {
  const text = rawTextSchema.parse(rawText);
  const userId = await getCurrentUserId();
  const dump = await withRepositories(userId, (repos) => repos.brainDumps.create(text));
  revalidatePath("/inbox");
  return { id: dump.id };
}

export type CommitResult =
  { ok: true; summary: CommitSummary } | { ok: false; message: string };

export async function commitBrainDump(input: unknown): Promise<CommitResult> {
  const parsed = commitInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Something in the review isn't valid — check titles and dates.",
    };
  }
  const userId = await getCurrentUserId();
  try {
    const summary = await withRepositories(userId, (repos) =>
      (async () => {
        const summary = await commitReviewedItems(repos, parsed.data, new Date());
        const profile = await repos.users.profile();
        await repos.users.savePreferences(profile?.timezone ?? "UTC", {
          onboardingCompleted: true,
        });
        return summary;
      })()
    );
    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (error) {
    console.error("capture.commit_failed", {
      dumpId: parsed.data.dumpId,
      items: parsed.data.items.length,
      error: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      message:
        "Couldn't save just now. Your review is still here, and your Brain Dump is saved — try again.",
    };
  }
}

const quickAddSchema = z.object({
  title: z.string().trim().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).nullable(),
});

/** Quick Add lands in the Inbox — captured, not yet organised (PRD §2.2). */
export async function quickAdd(input: unknown): Promise<{ ok: boolean }> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    const task = await repos.tasks.create({
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      source: "quick_add",
      status: "inbox",
    });
    await repos.taskEvents.record({
      taskId: task.id,
      eventType: "created",
      toStatus: "inbox",
    });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
