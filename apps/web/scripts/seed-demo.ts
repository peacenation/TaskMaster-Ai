// Creates a reviewer demo account with a realistic week of data
// (IMPLEMENTATION_PLAN.md Phase 12, work item 7). It signs up through
// Better Auth exactly as the sign-up page does, then writes through the
// same RLS-scoped repositories the app uses, so the account is
// indistinguishable from a real one.
//
//   DEMO_PASSWORD=... npm run db:seed:demo                 # local database
//   DEMO_PASSWORD=... npm run db:seed:demo -- --confirm    # any other host
//
// Optional: DEMO_EMAIL (default demo@taskmaster.example), DEMO_TIMEZONE
// (default Europe/London). Refuses if the account already exists; delete
// it from Settings first to start over.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const LOCAL = ["localhost", "127.0.0.1", "[::1]"];
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const email = process.env.DEMO_EMAIL || "demo@taskmaster.example";
  const password = process.env.DEMO_PASSWORD ?? "";
  const timeZone = process.env.DEMO_TIMEZONE || "Europe/London";
  if (password.length < 12) throw new Error("Set DEMO_PASSWORD (12+ characters).");
  const host = new URL(process.env.DATABASE_URL_APP ?? "").hostname;
  if (!LOCAL.includes(host) && !process.argv.includes("--confirm")) {
    throw new Error(`Refusing to seed ${host} without --confirm.`);
  }

  // Imported after the guard and dotenv, so nothing connects before them.
  const { getAuth } = await import("../lib/auth/server");
  const { withRepositories } = await import("../lib/repo");
  const { changeStatus } = await import("../lib/execution/operations");
  const { zonedParts, zonedTimeToUtc } = await import("../lib/domain/dates");

  const now = new Date();
  // A local wall-clock time `days` from today, in the demo user's timezone.
  const at = (days: number, hour: number) => {
    const p = zonedParts(new Date(now.getTime() + days * DAY), timeZone);
    return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, hour, 0, timeZone);
  };
  const isoDate = (days: number) => {
    const p = zonedParts(new Date(now.getTime() + days * DAY), timeZone);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  };

  const { user } = await getAuth().api.signUpEmail({
    body: { name: "Demo Reviewer", email, password },
  });

  await withRepositories(user.id, async (repos) => {
    await repos.users.savePreferences(timeZone, { onboardingCompleted: true });

    const dump = await repos.brainDumps.create(
      "Finish the quarterly report by Thursday, call the dentist, renew car insurance before the 20th, plan Sam's birthday, clear the garage at some point, prep slides for Thursday's team meeting"
    );
    await repos.brainDumps.markCommitted(dump.id);

    const work = await repos.projects.findOrCreate("Work");
    const home = await repos.projects.findOrCreate("Home");
    const fitness = await repos.goals.create({ title: "Run a 10k in spring" });
    const career = await repos.goals.create({ title: "Lead the Q1 planning cycle" });

    const task = (input: Parameters<typeof repos.tasks.create>[0]) =>
      repos.tasks.create({ status: "todo", source: "brain_dump", ...input });

    const report = await task({
      title: "Finish the quarterly report",
      projectId: work.id,
      goalId: career.id,
      dueAt: at(3, 17),
      estimatedMinutes: 120,
      priority: 5,
      energy: "high",
    });
    await task({
      title: "Prep slides for Thursday's team meeting",
      projectId: work.id,
      dueAt: at(3, 12),
      estimatedMinutes: 60,
      energy: "medium",
    });
    await task({
      title: "Send budget numbers to finance",
      projectId: work.id,
      dueAt: at(3, 15),
      estimatedMinutes: 20,
      energy: "low",
    });
    await task({
      title: "Call the dentist",
      projectId: home.id,
      estimatedMinutes: 10,
      energy: "low",
    });
    await task({
      title: "Renew car insurance",
      projectId: home.id,
      dueAt: at(9, 17),
      estimatedMinutes: 30,
    });
    await task({ title: "Plan Sam's birthday", projectId: home.id, estimatedMinutes: 45 });
    await task({
      title: "Book a running club taster session",
      goalId: fitness.id,
      estimatedMinutes: 15,
    });
    const garage = await task({
      title: "Clear the garage",
      projectId: home.id,
      estimatedMinutes: 180,
    });
    await task({ title: "Look into a standing desk", status: "inbox", source: "quick_add" });

    // History, so reviews and insights have something true to say.
    const reply = await task({
      title: "Reply to the landlord",
      projectId: home.id,
      estimatedMinutes: 15,
    });
    await changeStatus(repos, reply.id, "completed", now);
    const outline = await task({
      title: "Outline the report sections",
      projectId: work.id,
      goalId: career.id,
      estimatedMinutes: 30,
    });
    await changeStatus(repos, outline.id, "completed", now);
    await changeStatus(repos, report.id, "in_progress", now);
    for (let i = 0; i < 2; i++) {
      await changeStatus(repos, garage.id, "postponed", now);
      await changeStatus(repos, garage.id, "todo", now);
    }

    await repos.recurrenceRules.create({
      title: "Water the plants",
      frequency: "weekly",
      timesPerPeriod: 2,
      startDate: isoDate(0),
    });
    await repos.recurrenceRules.generateThrough(isoDate(0), isoDate(7));
  });

  console.log(`Demo account ready: ${email} (password as given in DEMO_PASSWORD).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
