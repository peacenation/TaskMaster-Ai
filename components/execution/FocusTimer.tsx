"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import {
  pauseTimer,
  readTimer,
  remainingTime,
  resumeTimer,
  startTimer,
  type FocusTimerState,
} from "@/lib/execution/timer";
export function FocusTimer({ userId, taskId }: { userId: string; taskId: string }) {
  const key = `taskmaster:timer:${userId}:${taskId}`;
  const [timer, setTimer] = useState<FocusTimerState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const load = () => {
      try {
        const saved = readTimer(localStorage.getItem(key));
        setTimer(saved);
        setRemaining(saved ? remainingTime(saved, Date.now()) : null);
      } catch {
        setStorageError(true);
      }
    };
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [key]);
  useEffect(() => {
    if (!timer) return;
    const tick = () => setRemaining(remainingTime(timer, Date.now()));
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timer]);
  function persist(value: FocusTimerState | null) {
    try {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    } catch {
      setStorageError(true);
    }
    setTimer(value);
    setRemaining(value ? remainingTime(value, Date.now()) : null);
  }
  const seconds = Math.ceil((remaining ?? minutes * 60000) / 1000);
  return (
    <section className="focus-timer" aria-labelledby="timer-heading">
      <h2 id="timer-heading">Focus timer</h2>
      <p className="timer-display" role="timer" aria-label="Time remaining">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </p>
      {timer && remaining === 0 && (
        <p role="status">Time is up. Take a breath, then decide what comes next.</p>
      )}
      {!timer && (
        <label>
          Minutes{" "}
          <Input
            type="number"
            min={1}
            max={240}
            value={minutes}
            onChange={(e) =>
              setMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 20)))
            }
          />
        </label>
      )}
      <div className="button-row">
        {!timer ? (
          <Button variant="secondary" onClick={() => persist(startTimer(minutes, Date.now()))}>
            Start timer
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                persist(
                  timer.endAt === null
                    ? resumeTimer(timer, Date.now())
                    : pauseTimer(timer, Date.now())
                )
              }
            >
              {timer.endAt === null ? "Resume timer" : "Pause timer"}
            </Button>
            <Button variant="secondary" onClick={() => persist(null)}>
              Reset timer
            </Button>
          </>
        )}
      </div>
      {storageError && (
        <p role="alert">Your browser could not save the timer. Keep this page open.</p>
      )}
    </section>
  );
}
