"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actOnTask } from "@/app/actions/execution";
import { Button } from "@/components/ui";
export function StartFocus({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const result = await actOnTask(taskId, "in_progress");
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.push(`/focus?task=${taskId}`);
            } catch {
              setError("Could not start focus. Try again.");
            }
          })
        }
      >
        {pending ? "Starting…" : "Start focus"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
