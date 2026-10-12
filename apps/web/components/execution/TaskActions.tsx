"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actOnTask } from "@/app/actions/execution";
import { Button, ConfirmDialog } from "@/components/ui";
export function TaskActions({ taskId, focus = false }: { taskId: string; focus?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [decision, setDecision] = useState("");
  const [dropping, setDropping] = useState(false);
  const router = useRouter();
  function act(status: string) {
    setError("");
    setDecision(status);
    start(async () => {
      try {
        const result = await actOnTask(taskId, status);
        if (!result.ok) {
          setError(result.message);
          setDecision("");
          return;
        }
        if (focus) router.push("/");
        router.refresh();
      } catch {
        setError("Could not connect. Nothing is lost — retry.");
        setDecision("");
      }
    });
  }
  return (
    <>
      <div className="button-row">
        <Button
          variant={focus ? "primary" : "secondary"}
          disabled={pending}
          onClick={() => act("completed")}
        >
          {pending && decision === "completed" ? "Completing…" : "Complete"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => act("postponed")}>
          Postpone
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => setDropping(true)}>
          Drop
        </Button>
      </div>
      {pending && <p role="status">Updating your plan…</p>}
      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={dropping}
        title="Drop this task?"
        description="It will leave your active plan. Its record stays in your task history."
        confirmLabel="Drop task"
        danger
        onCancel={() => setDropping(false)}
        onConfirm={() => {
          setDropping(false);
          act("dropped");
        }}
      />
    </>
  );
}
