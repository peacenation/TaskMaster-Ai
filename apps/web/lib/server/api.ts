import { isValidTimeZone } from "@/lib/domain/dates";
import { withRepositories, type Repositories } from "@/lib/repo";
import type { TaskRecord } from "@/lib/repo/task-repository";
import { getSession } from "@/lib/server/session";

// Shared plumbing for the versioned JSON API (/api/v1) the mobile app uses.
// The contract lives in packages/api-contract/openapi.yaml — change both
// together. Auth is the same Supabase Auth session as the web, its access
// token sent as `Authorization: Bearer <token>` instead of a cookie (ADR-013).

export interface ApiContext {
  userId: string;
  timeZone: string;
  profile: NonNullable<Awaited<ReturnType<Repositories["users"]["profile"]>>>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

/**
 * Wraps a route handler: verifies the session against the database (the
 * proxy only checks a token is present), resolves the user's time zone,
 * and turns failures into JSON errors without leaking internals.
 */
export function apiRoute<Args extends unknown[]>(
  handler: (ctx: ApiContext, request: Request, ...args: Args) => Promise<Response>
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      const session = await getSession();
      if (!session) return json({ error: "Unauthorized" }, 401);
      // One read per request; the profile is only written on first use.
      const profile = await withRepositories(session.user.id, async (repos) => {
        const existing = await repos.users.profile();
        if (existing?.authId) return existing;
        await repos.users.ensure({
          name: session.user.name,
          email: session.user.email,
          authId: session.user.id,
        });
        return repos.users.profile();
      });
      if (!profile) throw new ApiError(500, "Profile could not be created.");
      // A saved profile time zone wins; otherwise the device's, sent as a header.
      const header = request.headers.get("x-time-zone");
      const timeZone =
        profile.preferences.timezoneSet && isValidTimeZone(profile.timezone)
          ? profile.timezone
          : header && isValidTimeZone(header)
            ? header
            : "UTC";
      return await handler({ userId: session.user.id, timeZone, profile }, request, ...args);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error("api error", error instanceof Error ? error.name : "unknown");
      return json({ error: "Something went wrong. Try again." }, 500);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Expected a JSON body.");
  }
}

export interface TaskDto {
  id: string;
  title: string;
  status: TaskRecord["status"];
  priority: number | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  project: { id: string; name: string } | null;
}

export function toTaskDto(task: TaskRecord, projectNames: Map<string, string>): TaskDto {
  const projectName = task.projectId ? projectNames.get(task.projectId) : undefined;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    estimatedMinutes: task.estimatedMinutes,
    project: task.projectId && projectName ? { id: task.projectId, name: projectName } : null,
  };
}
