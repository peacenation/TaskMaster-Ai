"use client";

import { useActionState, useId } from "react";
import { deleteTask, saveTask, type TaskFormState } from "@/app/actions/tasks";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

// Manual task creation and editing (PRD §2.2, P0) — "a proper form,
// because not every user wants to type at the app."

export interface TaskFormValues {
  id?: string;
  title: string;
  description: string;
  /** Wall-clock datetime-local value in the user's timezone, or "". */
  dueLocal: string;
  estimatedMinutes: string;
  priority: string;
  importance: string;
  urgency: string;
  energy: string;
  status: string;
  project: string;
}

export const EMPTY_TASK: TaskFormValues = {
  title: "",
  description: "",
  dueLocal: "",
  estimatedMinutes: "",
  priority: "",
  importance: "",
  urgency: "",
  energy: "",
  status: "todo",
  project: "",
};

const SCALE = [
  ["", "—"],
  ["5", "5 · Very high"],
  ["4", "4 · High"],
  ["3", "3 · Normal"],
  ["2", "2 · Low"],
  ["1", "1 · Very low"],
] as const;

export function TaskForm({ task, projects }: { task: TaskFormValues; projects: string[] }) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(saveTask, {});
  const listId = useId();
  const error = (field: string) =>
    state.errors?.[field] ? (
      <p className="field-hint field-error">{state.errors[field]}</p>
    ) : null;

  return (
    <>
      <form action={action} className="task-form">
        {task.id && <input type="hidden" name="id" value={task.id} />}

        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" defaultValue={task.title} required maxLength={500} />
          {error("title")}
        </Field>

        <Field label="Notes" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={task.description}
            rows={3}
          />
        </Field>

        <div className="form-grid">
          <Field label="Due" htmlFor="dueLocal">
            <Input
              id="dueLocal"
              name="dueLocal"
              type="datetime-local"
              defaultValue={task.dueLocal}
            />
            {error("dueLocal")}
          </Field>
          <Field label="Estimate (minutes)" htmlFor="estimatedMinutes">
            <Input
              id="estimatedMinutes"
              name="estimatedMinutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={task.estimatedMinutes}
            />
            {error("estimatedMinutes")}
          </Field>
          <Field
            label="Your priority"
            htmlFor="priority"
            hint="Outweighs TaskMaster's own scoring."
          >
            <Select id="priority" name="priority" defaultValue={task.priority}>
              {SCALE.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Importance" htmlFor="importance">
            <Select id="importance" name="importance" defaultValue={task.importance}>
              {SCALE.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Urgency" htmlFor="urgency">
            <Select id="urgency" name="urgency" defaultValue={task.urgency}>
              {SCALE.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Energy needed" htmlFor="energy">
            <Select id="energy" name="energy" defaultValue={task.energy}>
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Project" htmlFor="project">
            <Input
              id="project"
              name="project"
              list={listId}
              defaultValue={task.project}
              maxLength={200}
            />
            <datalist id={listId}>
              {projects.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={task.status}>
              <option value="inbox">Inbox</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="postponed">Postponed</option>
              <option value="completed">Done</option>
              <option value="dropped">Dropped</option>
            </Select>
          </Field>
        </div>

        {state.message && (
          <p className="notice notice-danger" role="alert">
            {state.message}
          </p>
        )}

        <div className="button-row">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : task.id ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>

      {task.id && (
        <form action={deleteTask.bind(null, task.id)} className="danger-zone">
          <Button variant="danger" type="submit">
            Delete task
          </Button>
        </form>
      )}
    </>
  );
}
