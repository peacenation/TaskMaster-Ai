import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { projectInvites, projectMembers, projects, users } from "@/lib/db/schema";

// Shared projects: people, invitations and membership. Every query runs
// under RLS (migration 0015): owners invite and remove, invitees accept or
// decline invitations to their own email, members can leave.

export const INVITE_DAYS = 14;

export class SharingError extends Error {}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface Person {
  userId: string;
  name: string;
  email: string;
  isOwner: boolean;
}

export function createSharingRepository(db: AppDb, userId: string) {
  const openInvite = and(
    isNull(projectInvites.acceptedAt),
    isNull(projectInvites.declinedAt),
    gt(projectInvites.expiresAt, sql`now()`)
  );

  return {
    /** Owner first, then members; empty if you're not on the project. */
    async people(projectId: string): Promise<Person[]> {
      const rows = await db.execute<{
        user_id: string;
        name: string;
        email: string;
        is_owner: boolean;
      }>(sql`SELECT * FROM project_people(${projectId}) ORDER BY is_owner DESC, name`);
      return rows.rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        isOwner: r.is_owner,
      }));
    },

    /** Invite someone by email; returns the link token (shown once, stored hashed). */
    async invite(projectId: string, rawEmail: string) {
      const email = rawEmail.trim().toLowerCase();
      const [project] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
      if (!project) throw new SharingError("Only the project's owner can invite people.");
      const [me] = await db.select({ name: users.name, email: users.email }).from(users);
      if (me?.email.toLowerCase() === email) throw new SharingError("That's you.");
      const people = await this.people(projectId);
      if (people.some((p) => p.email.toLowerCase() === email))
        throw new SharingError("They're already on this project.");
      // One open invitation per person per project.
      await db
        .delete(projectInvites)
        .where(
          and(
            eq(projectInvites.projectId, projectId),
            sql`lower(${projectInvites.email}) = ${email}`,
            openInvite
          )
        );
      const token = randomBytes(24).toString("base64url");
      const [invite] = await db
        .insert(projectInvites)
        .values({
          projectId,
          userId,
          email,
          projectName: project.name,
          inviterName: me?.name ?? "",
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        })
        .returning({ id: projectInvites.id });
      return { id: invite.id, token };
    },

    /** Open invitations a project's owner has sent. */
    async pendingFor(projectId: string) {
      return db
        .select({
          id: projectInvites.id,
          email: projectInvites.email,
          expiresAt: projectInvites.expiresAt,
        })
        .from(projectInvites)
        .where(
          and(
            eq(projectInvites.projectId, projectId),
            eq(projectInvites.userId, userId),
            openInvite
          )
        );
    },

    /** Open invitations to the signed-in user's email. */
    async mine() {
      return db
        .select({
          id: projectInvites.id,
          projectId: projectInvites.projectId,
          projectName: projectInvites.projectName,
          inviterName: projectInvites.inviterName,
          expiresAt: projectInvites.expiresAt,
        })
        .from(projectInvites)
        .where(
          and(sql`lower(${projectInvites.email}) = app_current_user_email()`, openInvite)
        );
    },

    /** An invitation by its link token, if it's open and for you. */
    async byToken(token: string) {
      const [invite] = await db
        .select({ id: projectInvites.id, email: projectInvites.email })
        .from(projectInvites)
        .where(and(eq(projectInvites.tokenHash, hashToken(token)), openInvite));
      return invite ?? null;
    },

    async accept(inviteId: string): Promise<string> {
      const [invite] = await db
        .select({ projectId: projectInvites.projectId })
        .from(projectInvites)
        .where(
          and(
            eq(projectInvites.id, inviteId),
            sql`lower(${projectInvites.email}) = app_current_user_email()`,
            openInvite
          )
        );
      if (!invite) throw new SharingError("This invitation has expired or isn't for you.");
      // RLS checks the open invitation to your email before letting you in.
      await db
        .insert(projectMembers)
        .values({ projectId: invite.projectId, userId })
        .onConflictDoNothing();
      await db
        .update(projectInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(projectInvites.id, inviteId));
      return invite.projectId;
    },

    async decline(inviteId: string) {
      const updated = await db
        .update(projectInvites)
        .set({ declinedAt: new Date() })
        .where(
          and(
            eq(projectInvites.id, inviteId),
            sql`lower(${projectInvites.email}) = app_current_user_email()`,
            openInvite
          )
        )
        .returning({ id: projectInvites.id });
      return updated.length > 0;
    },

    async withdraw(inviteId: string) {
      await db
        .delete(projectInvites)
        .where(and(eq(projectInvites.id, inviteId), eq(projectInvites.userId, userId)));
    },

    /** Owner removes a member, or a member leaves (memberId = themselves). */
    async remove(projectId: string, memberId: string) {
      // Their assignments in this project go back to unassigned — first,
      // while whoever is asking can still reach the project's tasks.
      await db.execute(
        sql`UPDATE tasks SET assignee_id = NULL WHERE project_id = ${projectId} AND assignee_id = ${memberId}`
      );
      const removed = await db
        .delete(projectMembers)
        .where(
          and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId))
        )
        .returning({ id: projectMembers.id });
      if (removed.length === 0) throw new SharingError("Couldn't remove that person.");
    },
  };
}
