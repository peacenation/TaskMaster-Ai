import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";
import { SharingError } from "@/lib/repo/sharing-repository";
import { canAssign } from "@/lib/server/sharing";

// Shared projects, against real Postgres with RLS (migration 0015): what
// owners, members and strangers can and can't do.

const admin = getAdminDb();
let owner: string;
let member: string;
let stranger: string;
let projectId: string;
let sharedTask: string;
let privateTask: string;

const as = withRepositories;

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const users = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES
        ('Olu Owner', 'owner@test.local'),
        ('Mia Member', 'mia@test.local'),
        ('Sam Stranger', 'sam@test.local') RETURNING id`
  );
  [owner, member, stranger] = users.rows.map((r) => r.id);
  ({ projectId, sharedTask, privateTask } = await as(owner, async (repos) => {
    const project = await repos.projects.findOrCreate("Website");
    const t1 = await repos.tasks.create({ title: "Design homepage", projectId: project.id });
    const t2 = await repos.tasks.create({ title: "Private errand" });
    return { projectId: project.id, sharedTask: t1.id, privateTask: t2.id };
  }));
});

async function invite(email = "mia@test.local") {
  return as(owner, (repos) => repos.sharing.invite(projectId, email));
}

async function join() {
  const { id } = await invite();
  await as(member, (repos) => repos.sharing.accept(id));
}

describe("shared projects", () => {
  it("shows an invitation only to the person it's for", async () => {
    await invite();
    expect(await as(member, (r) => r.sharing.mine())).toEqual([
      expect.objectContaining({ projectName: "Website", inviterName: "Olu Owner" }),
    ]);
    expect(await as(stranger, (r) => r.sharing.mine())).toEqual([]);
  });

  it("lets nobody else accept it, or join without one", async () => {
    const { id } = await invite();
    await expect(as(stranger, (r) => r.sharing.accept(id))).rejects.toThrow(SharingError);
    await expect(
      as(stranger, (r) =>
        admin.execute(sql`SELECT 1`).then(() => r.sharing.remove(projectId, stranger))
      )
    ).rejects.toThrow(SharingError);
    // Writing the membership row directly is refused by RLS.
    await expect(
      as(stranger, (repos) => repos.sharing.accept("00000000-0000-0000-0000-000000000000"))
    ).rejects.toThrow(SharingError);
    expect(await as(stranger, (r) => r.projects.get(projectId))).toBeUndefined();
  });

  it("gives members the project and its tasks, but not the owner's other work", async () => {
    await join();
    const projects = await as(member, (r) => r.projects.list());
    expect(projects.map((p) => p.name)).toEqual(["Website"]);
    const visible = (await as(member, (r) => r.tasks.visible())).map((t) => t.id);
    expect(visible).toContain(sharedTask);
    expect(visible).not.toContain(privateTask);
    expect(await as(member, (r) => r.tasks.get(privateTask))).toBeUndefined();
    const people = await as(member, (r) => r.sharing.people(projectId));
    expect(people.map((p) => [p.name, p.isOwner])).toEqual([
      ["Olu Owner", true],
      ["Mia Member", false],
    ]);
    expect(await as(stranger, (r) => r.sharing.people(projectId))).toEqual([]);
  });

  it("lets members work on tasks but not change or delete the project", async () => {
    await join();
    await as(member, (r) => r.tasks.update(sharedTask, { status: "completed" }));
    const done = await as(owner, (r) => r.tasks.get(sharedTask));
    expect(done?.status).toBe("completed");
    const created = await as(member, (r) =>
      r.tasks.create({ title: "Write copy", projectId })
    );
    expect((await as(owner, (r) => r.tasks.visible())).map((t) => t.id)).toContain(created.id);
    await as(member, (r) => r.projects.updateOutcome(projectId, "hijacked", null));
    expect((await as(owner, (r) => r.projects.get(projectId)))?.description).toBeNull();
    const deleted = await as(member, (r) =>
      admin.execute(sql`SELECT 1`).then(() => r.sharing.people(projectId))
    );
    expect(deleted).toHaveLength(2);
  });

  it("puts work assigned to you on your list, and only to people on the project", async () => {
    await join();
    await as(owner, async (repos) => {
      expect(await canAssign(repos, projectId, member)).toBe(true);
      expect(await canAssign(repos, projectId, stranger)).toBe(false);
      expect(await canAssign(repos, null, member)).toBe(false);
      await repos.tasks.update(sharedTask, { assigneeId: member });
    });
    const mine = (await as(member, (r) => r.tasks.list())).map((t) => t.id);
    expect(mine).toContain(sharedTask);
  });

  it("takes everything away when a member is removed, and unassigns them", async () => {
    await join();
    await as(owner, (r) => r.tasks.update(sharedTask, { assigneeId: member }));
    await as(owner, (r) => r.sharing.remove(projectId, member));
    expect(await as(member, (r) => r.projects.get(projectId))).toBeUndefined();
    expect(await as(member, (r) => r.tasks.get(sharedTask))).toBeUndefined();
    expect((await as(owner, (r) => r.tasks.get(sharedTask)))?.assigneeId).toBeNull();
  });

  it("lets a member leave, but not remove anyone else", async () => {
    await join();
    await expect(as(member, (r) => r.sharing.remove(projectId, owner))).rejects.toThrow(
      SharingError
    );
    await as(member, (r) => r.sharing.remove(projectId, member));
    expect(await as(member, (r) => r.projects.list())).toEqual([]);
  });

  it("refuses odd invitations: yourself, non-owners, existing members, expired ones", async () => {
    await expect(invite("owner@test.local")).rejects.toThrow(/That's you/);
    await join();
    await expect(invite("mia@test.local")).rejects.toThrow(/already on this project/);
    await expect(
      as(member, (r) => r.sharing.invite(projectId, "sam@test.local"))
    ).rejects.toThrow(/Only the project's owner/);
    const { id } = await invite("sam@test.local");
    await admin.execute(
      sql`UPDATE project_invites SET expires_at = now() - interval '1 minute' WHERE id = ${id}`
    );
    await expect(as(stranger, (r) => r.sharing.accept(id))).rejects.toThrow(SharingError);
  });

  it("stores only a hash of the invitation link", async () => {
    const { token } = await invite();
    const stored = await admin.execute<{ token_hash: string }>(
      sql`SELECT token_hash FROM project_invites`
    );
    expect(stored.rows[0].token_hash).not.toContain(token);
    expect((await as(member, (r) => r.sharing.byToken(token)))?.email).toBe("mia@test.local");
  });
});
