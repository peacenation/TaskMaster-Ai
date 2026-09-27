import { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
}

export function Chip({ children, onRemove }: ChipProps) {
  return (
    <span className="chip">
      {children}
      {onRemove && (
        <button
          type="button"
          className="chip-remove"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "item"}`}
        >
          ✕
        </button>
      )}
    </span>
  );
}
