// Drizzle schema translating PRD_v2.md §1.10, plus what Phase 3's own work
// item adds because the PRD implies it without naming it (see
// docs/IMPLEMENTATION_PLAN.md Phase 3, work item 1): TaskEvent (§3.3
// history), TaskDependency (§2.3 scoring signal), RecurrenceRule (§3.1 P0
// recurring responsibilities), BrainDump.proposalJson (§1.11
// recoverability — the raw AI proposal survives a failed save).
//
// RLS policies live in migrations/0001_row_level_security.sql, not here —
// see docs/adr/ADR-004-row-level-security.md and docs/ERD.md.
//
// user_id is denormalized onto every table, including child tables that
// could instead join to a parent (task_dependencies, task_events,
// plan_items). This is deliberate: it keeps every RLS policy a flat
// `user_id = app_current_user_id()` check instead of a correlated
// subquery through the parent table. See docs/ERD.md.

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
export {
  authUser,
  authSession,
  authAccount,
  authVerification,
  authRateLimit,
} from "./auth-schema";

export const taskStatusEnum = pgEnum("task_status", [
  "inbox",
  "todo",
  "in_progress",
  "completed",
  "postponed",
  "dropped",
]);
export const projectStatusEnum = pgEnum("project_status", ["active", "completed", "archived"]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "archived"]);
export const planModeEnum = pgEnum("plan_mode", ["flexible", "scheduled"]);
export const brainDumpStatusEnum = pgEnum("brain_dump_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const taskSourceEnum = pgEnum("task_source", [
  "brain_dump",
  "quick_add",
  "manual",
  "recurrence",
]);
export const energyEnum = pgEnum("energy_requirement", ["low", "medium", "high"]);
export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "daily",
  "weekly",
  "monthly",
]);
export const taskEventTypeEnum = pgEnum("task_event_type", [
  "created",
  "status_changed",
  "priority_changed",
  "postponed",
  "completed",
  "rescheduled",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The Supabase Auth user (auth.users.id; equal to `id`). No foreign key:
  // locally the Auth service keeps its users in its own database (ADR-013).
  // In Supabase, a trigger on auth.users deletes this row (migration 0009).
  authId: uuid("auth_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  timezone: text("timezone").notNull().default("UTC"),
  preferences: jsonb("preferences").notNull().default({}),
  // Billing (PRD §5.1): written only by the Stripe webhook, never by a
  // request the user makes (lib/billing). "free" until a subscription is
  // active; planStatus mirrors Stripe's (active, past_due, canceled…).
  plan: text("plan", { enum: ["free", "pro"] })
    .notNull()
    .default("free"),
  planStatus: text("plan_status"),
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetDate: date("target_date"),
    status: goalStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_user_id_idx").on(table.userId)]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    dueDate: date("due_date"),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)]
);

export const brainDumps = pgTable(
  "brain_dumps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull(),
    processingStatus: brainDumpStatusEnum("processing_status").notNull().default("pending"),
    // The raw extraction proposal, kept even on a failed save — PRD §1.11
    // Recoverability: "Failed AI processing must not destroy or silently
    // alter user input."
    proposalJson: jsonb("proposal_json"),
    // Null until the user commits the reviewed proposal; an extracted but
    // uncommitted dump is one the Inbox offers to resume.
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("brain_dumps_user_id_idx").on(table.userId)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("inbox"),
    priority: smallint("priority"),
    urgency: smallint("urgency"),
    importance: smallint("importance"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    estimatedMinutes: integer("estimated_minutes"),
    energyRequirement: energyEnum("energy_requirement"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    occurrenceDate: date("occurrence_date"),
    occurrenceSlot: integer("occurrence_slot"),
    source: taskSourceEnum("source").notNull().default("manual"),
    // Waiting On (PRD §4.1): someone else owns the next step. A waiting
    // task leaves today's plan until its follow-up is due.
    waitingOn: text("waiting_on"),
    waitingSince: timestamp("waiting_since", { withTimezone: true }),
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    // clock_timestamp(), not now(): now() is the *transaction's* start time,
    // so every task in a Brain Dump commit would tie, and "oldest first"
    // would fall back to random UUID order instead of the reviewed order.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_user_status_idx").on(table.userId, table.status),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_due_date_idx").on(table.dueDate),
    unique("tasks_recurrence_occurrence_unique").on(
      table.recurrenceRuleId,
      table.occurrenceDate,
      table.occurrenceSlot
    ),
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_dependencies_user_id_idx").on(table.userId),
    unique("task_dependencies_unique").on(table.taskId, table.dependsOnTaskId),
  ]
);

export const taskEvents = pgTable(
  "task_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    eventType: taskEventTypeEnum("event_type").notNull(),
    fromStatus: taskStatusEnum("from_status"),
    toStatus: taskStatusEnum("to_status"),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_events_user_id_idx").on(table.userId),
    index("task_events_task_id_idx").on(table.taskId),
  ]
);

export const recurrenceRules = pgTable(
  "recurrence_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    frequency: recurrenceFrequencyEnum("frequency").notNull(),
    intervalCount: integer("interval_count").notNull().default(1),
    // "Gym three times a week" — a count per period, distinct from
    // interval_count ("every 2 weeks").
    timesPerPeriod: integer("times_per_period").notNull().default(1),
    daysOfWeek: jsonb("days_of_week"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recurrence_rules_user_id_idx").on(table.userId)]
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    mode: planModeEnum("mode").notNull().default("flexible"),
    availableMinutes: integer("available_minutes"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("plans_user_date_idx").on(table.userId, table.date),
    unique("plans_user_date_unique").on(table.userId, table.date),
  ]
);

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    recommendationReason: text("recommendation_reason"),
    recoveryReviewedAt: timestamp("recovery_reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("plan_items_user_id_idx").on(table.userId),
    index("plan_items_plan_id_idx").on(table.planId),
  ]
);

// One row per Claude extraction request, for the per-user hourly quota
// (app/api/extract/route.ts). Rows older than the window are pruned on
// each claim, so this never holds more than an hour of history.
export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_requests_user_created_idx").on(table.userId, table.createdAt)]
);

// Calendar feeds (PRD §4.1 Calendar Integration): a private iCal address
// the user pastes from Google, Outlook or Apple Calendar. The address is
// a credential (anyone with it can read the calendar), so it's stored
// encrypted (lib/calendar/secret.ts) and never sent back to a client.
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    urlEncrypted: text("url_encrypted").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("calendar_feeds_user_id_idx").on(table.userId)]
);

// The next few weeks of events from each feed, refreshed on sync, so
// Today never waits on a calendar server.
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => calendarFeeds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
  },
  (table) => [
    index("calendar_events_user_starts_idx").on(table.userId, table.startsAt),
    index("calendar_events_feed_id_idx").on(table.feedId),
  ]
);

// Product events (PRD §2.9 MVP Success Metrics): what happened, never what
// was written — names, counts and ids only, no task or Brain Dump text.
// `dedupeKey` makes once-a-day events (today_viewed) idempotent.
export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    properties: jsonb("properties").notNull().default({}),
    dedupeKey: text("dedupe_key"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("product_events_name_time_idx").on(table.name, table.occurredAt),
    index("product_events_user_id_idx").on(table.userId),
    unique("product_events_user_dedupe_unique").on(table.userId, table.dedupeKey),
  ]
);
