import Link from "next/link";
import { redirect } from "next/navigation";
import { RecoveryCheckIn } from "@/components/execution/RecoveryCheckIn";
import { PlanSettings } from "@/components/planning/PlanSettings";
import { localDate } from "@/lib/execution/date";
import { QuickAdd } from "@/components/capture/QuickAdd";
import { CapacityMeter } from "@/components/planning/CapacityMeter";
import { NextBestAction } from "@/components/planning/NextBestAction";
import { PlanView } from "@/components/planning/PlanView";
import { TaskRow } from "@/components/planning/TaskRow";
import { EmptyState } from "@/components/ui";
import { buildToday, todaySettingsSchema } from "@/lib/planning/today";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { toPlannable } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const { records, dependencies, projects, chosenId, profile } = await withRepositories(
    userId,
    async (repos) => ({
      records: await repos.tasks.list(),
      dependencies: await repos.tasks.dependencies(),
      projects: await repos.projects.list(),
      chosenId: await repos.users.nextTaskId(),
      profile: await repos.users.profile(),
    })
  );
  if (!profile?.preferences.onboardingCompleted) redirect("/dump");
  const settings = todaySettingsSchema.parse({
    dayMinutes: profile.preferences.dayMinutes ?? 240,
    availableMinutes: profile.preferences.availableMinutes ?? undefined,
    energy: profile.preferences.energy ?? undefined,
    ...query,
  });
  const now = new Date();
  const today = buildToday(
    toPlannable(records, dependencies),
    {
      now,
      timeZone,
      availableMinutes: settings.availableMinutes,
      energy: settings.energy,
    },
    settings.dayMinutes,
    chosenId
  );
  const date = localDate(now, timeZone);
  const { saved, recovery } = await withRepositories(userId, async (repos) => {
    if (!(await repos.execution.plan(date)))
      await repos.execution.savePlan(date, today.plan, false);
    return {
      saved: await repos.execution.plan(date),
      recovery: await repos.execution.recovery(now),
    };
  });
  const { plan, recommendation } = today;
  if (saved) {
    const scored = new Map(today.ranked.map((item) => [item.task.id, item]));
    plan.items = saved.items.flatMap((item) => {
      const current = scored.get(item.taskId);
      if (!current) return [];
      return [
        {
          task: current.task,
          score: current.score,
          reasons: current.reasons,
          position: item.position,
          minutes: current.task.estimatedMinutes ?? 30,
          estimateIsDefault: current.task.estimatedMinutes === null,
          protected: item.recommendationReason?.includes("protected") ?? false,
          scheduledStart: item.scheduledStart,
          scheduledEnd: item.scheduledEnd,
        },
      ];
    });
    plan.deferred = today.ranked.filter(
      (item) => !plan.items.some((planned) => planned.task.id === item.task.id)
    );
    plan.capacity.availableMinutes = saved.availableMinutes;
    plan.capacity.usableMinutes = Math.floor(
      (saved.availableMinutes ?? settings.dayMinutes) * 0.8
    );
    plan.capacity.plannedMinutes = plan.items.reduce((total, item) => total + item.minutes, 0);
    plan.capacity.overloaded = plan.capacity.mustDoMinutes > plan.capacity.usableMinutes;
  }
  const completedToday = records.filter(
    (task) => task.completedAt && localDate(task.completedAt, timeZone) === date
  ).length;
  const inboxCount = records.filter((task) => task.status === "inbox").length;
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const row = (item: (typeof today.ranked)[number], reason?: string) => (
    <TaskRow
      key={item.task.id}
      item={item}
      timeZone={timeZone}
      project={names.get(item.task.projectId ?? "")}
      reason={reason}
      chosen={today.overridden && recommendation?.task.id === item.task.id}
    />
  );
  const time = (date: Date) =>
    date.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Today</p>
        <h1>What to do next</h1>
        <p>A realistic plan, with room for life.</p>
      </header>
      {inboxCount > 0 && (
        <p className="notice">
          {inboxCount} item{inboxCount === 1 ? "" : "s"} waiting in your{" "}
          <Link href="/inbox">Inbox</Link>.
        </p>
      )}
      <p className="notice">
        {completedToday} completed today ·{" "}
        {records.filter((task) => ["todo", "in_progress"].includes(task.status)).length} active
        tasks
      </p>
      <PlanSettings
        dayMinutes={settings.dayMinutes}
        availableMinutes={settings.availableMinutes}
        energy={settings.energy}
      />
      {recovery.length > 0 && <RecoveryCheckIn items={recovery} />}
      {recommendation ? (
        <NextBestAction recommendation={recommendation} overridden={today.overridden} />
      ) : (
        <EmptyState
          title={
            today.blocked.length
              ? "Your active tasks are waiting on other work"
              : "Nothing active yet"
          }
          description="Capture new work or organise your Inbox to get started."
          action={
            <Link href="/dump" className="btn btn-primary">
              Start a Brain Dump
            </Link>
          }
        />
      )}
      {chosenId && !today.overridden && (
        <p className="field-hint">
          Your chosen task is no longer actionable. The current recommendation uses your
          remaining active work.
        </p>
      )}
      <CapacityMeter
        capacity={plan.capacity}
        bufferMinutes={
          (plan.capacity.availableMinutes ?? settings.dayMinutes) -
          (plan.capacity.usableMinutes ?? settings.dayMinutes)
        }
        gapMinutes={today.gapMinutes}
      />
      {today.overridden &&
        recommendation &&
        !plan.items.some((item) => item.task.id === recommendation.task.id) && (
          <p className="notice">
            Your chosen next action is outside today&apos;s scheduled budget. It remains your
            choice. Increase your available time or revise its estimate to include a block.
          </p>
        )}
      <PlanView
        defaultMode={String(profile.preferences.planMode ?? "flexible")}
        flexible={
          <ol className="today-task-list">
            {plan.items.map((item) =>
              row(
                { ...item, blocked: false },
                item.protected
                  ? "Protected so urgent work does not crowd out your longer-term goal."
                  : `Included because ${
                      item.reasons
                        .filter((r) => r.weight > 0)
                        .map((r) => r.text)
                        .slice(0, 2)
                        .join(" and ") || "it fits today's time and ranking"
                    }.`
              )
            )}
          </ol>
        }
        scheduled={
          <div className="scheduled-plan">
            {plan.items.map((item, index) => (
              <div key={item.task.id} className="scheduled-block">
                <p className="schedule-time">
                  {time(item.scheduledStart!)}–{time(item.scheduledEnd!)} · {item.minutes} min
                  {item.estimateIsDefault ? " suggested" : ""}
                </p>
                <ol className="today-task-list">
                  {row(
                    { ...item, blocked: false },
                    item.protected
                      ? "Protected time for longer-term work."
                      : "Estimated block, in priority order."
                  )}
                </ol>
                {index < plan.items.length - 1 && (
                  <p className="schedule-gap">
                    {today.gapMinutes} minutes to pause or switch tasks
                  </p>
                )}
              </div>
            ))}
          </div>
        }
      />
      {plan.items.length === 0 && (
        <p className="notice">
          No estimated block fits the day&apos;s usable time. You can still act on the
          recommendation or increase your available time.
        </p>
      )}
      {plan.deferred.length > 0 && (
        <section aria-labelledby="wait-heading">
          <h2 id="wait-heading">What can wait</h2>
          <p className="field-hint">
            Outside today&apos;s time budget. Deadlines still matter; deferral changes neither
            dates nor status.
          </p>
          <ul className="today-task-list">
            {plan.deferred.map((item) =>
              row(
                item,
                item.task.dueAt && item.task.dueAt.getTime() <= now.getTime() + 86400000
                  ? "Deadline warning: this task is due within 24 hours or overdue and does not fit today's plan."
                  : "Left outside today's plan to preserve realistic capacity and buffer."
              )
            )}
          </ul>
        </section>
      )}
      {today.blocked.length > 0 && (
        <section>
          <h2>Waiting on another task</h2>
          <ul>
            {today.blocked.map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`}>{task.title}</Link> — finish its dependencies
                first.
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="capture-heading">
        <h2 id="capture-heading">Capture</h2>
        <QuickAdd />
        <p className="field-hint">
          Got a lot on your mind? <Link href="/dump">Start a Brain Dump</Link>.
        </p>
      </section>
    </div>
  );
}
