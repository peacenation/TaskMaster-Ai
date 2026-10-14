import { describe, expect, it } from "vitest";
import { buildPlannerPrompt, validateBlocks, type PlannerTask } from "./plan";

const tasks: PlannerTask[] = [
  {
    id: "t1",
    title: "Write proposal",
    project: "Work",
    minutes: 60,
    due: null,
    priority: 5,
    inTodaysPlan: true,
  },
  {
    id: "t2",
    title: "Review designs",
    project: null,
    minutes: 30,
    due: null,
    priority: null,
    inTodaysPlan: false,
  },
];

describe("validateBlocks", () => {
  it("keeps the user's tasks with titles from the database, sorted by start", () => {
    const blocks = validateBlocks(
      {
        reply: "ok",
        blocks: [
          {
            kind: "task",
            taskId: "t2",
            label: "renamed by the model",
            start: "13:00",
            minutes: 30,
          },
          { kind: "event", taskId: null, label: "Team meeting", start: "14:00", minutes: 60 },
          { kind: "task", taskId: "t1", label: "x", start: "09:00", minutes: 60 },
        ],
      },
      tasks
    );
    expect(blocks.map((b) => [b.start, b.title])).toEqual([
      ["09:00", "Write proposal"],
      ["13:00", "Review designs"],
      ["14:00", "Team meeting"],
    ]);
  });

  it("drops invented tasks, duplicates, bad times and silly durations", () => {
    const blocks = validateBlocks(
      {
        reply: "",
        blocks: [
          { kind: "task", taskId: "not-mine", label: "Invented", start: "09:00", minutes: 30 },
          { kind: "task", taskId: null, label: "No id", start: "09:00", minutes: 30 },
          { kind: "task", taskId: "t1", label: "", start: "25:00", minutes: 30 },
          { kind: "task", taskId: "t1", label: "", start: "10:00", minutes: 2 },
          { kind: "task", taskId: "t1", label: "", start: "10:00", minutes: 45 },
          { kind: "task", taskId: "t1", label: "", start: "11:00", minutes: 45 },
          { kind: "break", taskId: null, label: "   ", start: "12:00", minutes: 30 },
        ],
      },
      tasks
    );
    expect(blocks).toEqual([
      {
        kind: "task",
        taskId: "t1",
        title: "Write proposal",
        project: "Work",
        start: "10:00",
        minutes: 45,
      },
    ]);
  });
});

describe("buildPlannerPrompt", () => {
  it("includes the request, tasks and only the recent conversation", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      text: `turn ${i}`,
    }));
    const prompt = JSON.parse(
      buildPlannerPrompt({
        request: "Plan my day around my 2pm meeting",
        history,
        nowLocal: "09:00",
        date: "2026-10-14",
        timeZone: "Europe/London",
        usableMinutes: 192,
        tasks,
      })
    );
    expect(prompt.request).toBe("Plan my day around my 2pm meeting");
    expect(prompt.tasks).toHaveLength(2);
    expect(prompt.conversation.map((t: { text: string }) => t.text)).toEqual([
      "turn 4",
      "turn 5",
      "turn 6",
      "turn 7",
      "turn 8",
      "turn 9",
    ]);
  });
});
