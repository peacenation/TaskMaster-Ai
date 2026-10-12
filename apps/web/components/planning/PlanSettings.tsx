"use client";
import { useActionState } from "react";
import { rebuildPlan } from "@/app/actions/execution";
import { Button, Field, Input, Select } from "@/components/ui";
export function PlanSettings({
  dayMinutes,
  availableMinutes,
  energy,
}: {
  dayMinutes: number;
  availableMinutes?: number;
  energy?: string;
}) {
  const [state, action, pending] = useActionState(rebuildPlan, {});
  return (
    <form action={action} className="today-settings">
      <Field label="Time available today (minutes)" htmlFor="dayMinutes">
        <Input
          id="dayMinutes"
          name="dayMinutes"
          type="number"
          min={1}
          max={1440}
          required
          defaultValue={dayMinutes}
        />
      </Field>
      <Field
        label="Time available right now (minutes)"
        htmlFor="availableMinutes"
        hint="Optional: find an action that fits this stretch."
      >
        <Input
          id="availableMinutes"
          name="availableMinutes"
          type="number"
          min={1}
          max={1440}
          defaultValue={availableMinutes ?? ""}
        />
      </Field>
      <Field label="Energy right now" htmlFor="energy">
        <Select id="energy" name="energy" defaultValue={energy ?? ""}>
          <option value="">Any energy</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Building…" : "Rebuild my plan"}
      </Button>
      {state.message && (
        <p className="notice notice-danger" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
