// Drizzle schema translating PRD_v2.md §1.10, plus what Phase 3's own work
// item adds because the PRD implies it without naming it (see
// docs/IMPLEMENTATION_PLAN.md Phase 3, work item 1): TaskEvent (§3.3
// history), TaskDependency (§2.3 scoring signal), RecurrenceRule (§3.1 P0
// recurring responsibilities), BrainDump.proposalJson (§1.11
// recoverability — the raw AI proposal survives a failed save).
//
// RLS policies live in migrations/0002_row_level_security.sql, not here —
// see docs/adr/ADR-004-row-level-security.md and docs/ERD.md.
//
// user_id is denormalized onto every table, including child tables that
// could instead join to a parent (task_dependencies, task_events,
// plan_items). This is deliberate: it keeps every RLS policy a flat
// `user_id = app_current_user_id()` check instead of a correlated
// subquery through the parent table. See docs/ERD.md.

import {
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
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "inbox",
  "todo",
  "in_progress",
  "completed",
  "postponed",
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
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  timezone: text("timezone").notNull().default("UTC"),
  preferences: jsonb("preferences").notNull().default({}),
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
    source: taskSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_user_status_idx").on(table.userId, table.status),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_due_date_idx").on(table.dueDate),
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
    daysOfWeek: jsonb("days_of_week"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
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
  },
  (table) => [
    index("plan_items_user_id_idx").on(table.userId),
    index("plan_items_plan_id_idx").on(table.planId),
  ]
);
