import { ReactNode } from "react";

export type ToastTone = "default" | "success" | "danger";

export interface ToastProps {
  tone?: ToastTone;
  children: ReactNode;
  onDismiss?: () => void;
}

/**
 * Presentational only — no global toast manager/provider exists yet.
 * Add one (context + queue) when a feature first needs to fire a toast
 * imperatively, rather than building it ahead of that need.
 */
export function Toast({ tone = "default", children, onDismiss }: ToastProps) {
  const classes = ["toast", tone !== "default" && `toast-${tone}`].filter(Boolean).join(" ");
  return (
    <div className={classes} role="status">
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          className="toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
