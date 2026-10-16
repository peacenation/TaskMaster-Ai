"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { SharingError } from "@/lib/repo/sharing-repository";
import { getCurrentUserId } from "@/lib/server/session";
import { inviteLink } from "@/lib/server/sharing";

export interface InviteState {
  ok?: boolean;
  message?: string;
  link?: string;
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function inviteToProject(
  projectId: string,
  _previous: InviteState,
  form: FormData
): Promise<InviteState> {
  const id = z.string().uuid().parse(projectId);
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { message: "Enter their email address." };
  try {
    const { token } = await withRepositories(await getCurrentUserId(), async (repos) => {
      const created = await repos.sharing.invite(id, email.data);
      await repos.events.track("project_invite_sent", { project_id: id });
      return created;
    });
    revalidatePath(`/projects/${id}`);
    return {
      ok: true,
      message: `Invited ${email.data}. They'll see it when they sign in with that email — or send them this link:`,
      link: inviteLink(await origin(), token),
    };
  } catch (error) {
    return {
      message:
        error instanceof SharingError ? error.message : "Couldn't invite them. Try again.",
    };
  }
}

export async function withdrawInvite(projectId: string, inviteId: string): Promise<void> {
  const id = z.string().uuid().parse(inviteId);
  await withRepositories(await getCurrentUserId(), (repos) => repos.sharing.withdraw(id));
  revalidatePath(`/projects/${z.string().uuid().parse(projectId)}`);
}

/** Owner removes someone; a member removing themselves leaves. */
export async function removeFromProject(projectId: string, memberId: string): Promise<void> {
  const ids = z
    .object({ p: z.string().uuid(), m: z.string().uuid() })
    .parse({ p: projectId, m: memberId });
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) => repos.sharing.remove(ids.p, ids.m));
  revalidatePath("/", "layout");
  if (ids.m === userId) redirect("/projects");
}

export async function answerInvite(inviteId: string, accept: boolean): Promise<void> {
  const id = z.string().uuid().parse(inviteId);
  const projectId = await withRepositories(await getCurrentUserId(), async (repos) => {
    if (!accept) {
      await repos.sharing.decline(id);
      return null;
    }
    const joined = await repos.sharing.accept(id);
    await repos.events.track("project_joined", { project_id: joined });
    return joined;
  }).catch((error) => {
    if (error instanceof SharingError) return null;
    throw error;
  });
  revalidatePath("/", "layout");
  redirect(projectId ? `/projects/${projectId}` : "/projects");
}
