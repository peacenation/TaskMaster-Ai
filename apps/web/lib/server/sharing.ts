import type { Repositories } from "@/lib/repo";
import type { Person } from "@/lib/repo/sharing-repository";

// Shared-project helpers used by the web pages and /api/v1 alike.

export function inviteLink(origin: string, token: string) {
  return `${origin}/invites/${token}`;
}

export function originOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwarded ? `${proto}://${forwarded}` : new URL(request.url).origin;
}

export function peopleDto(people: Person[], me: string) {
  return people.map((p) => ({
    id: p.userId,
    name: p.name,
    email: p.email,
    role: p.isOwner ? "owner" : "member",
    isMe: p.userId === me,
  }));
}

/** Can `assigneeId` be given work in this task's project? (null always can.) */
export async function canAssign(
  repos: Repositories,
  projectId: string | null,
  assigneeId: string | null
) {
  if (assigneeId === null) return true;
  if (!projectId) return false;
  return (await repos.sharing.people(projectId)).some((p) => p.userId === assigneeId);
}
