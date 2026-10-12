import { ReactNode } from "react";

export type CardVariant = "default" | "ai" | "confirmed";

export interface CardProps {
  variant?: CardVariant;
  kicker?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * `variant="ai"` and `variant="confirmed"` must stay visually distinct —
 * PRD_v2.md §2.8 requires AI recommendations to read as different from
 * confirmed user decisions, not just a subtle colour shift (see the
 * refinement note in PRD_v2.md §2.8.1).
 */
export function Card({ variant = "default", kicker, title, children, className }: CardProps) {
  const classes = ["card", variant !== "default" && `card-${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      {kicker && <p className="card-kicker">{kicker}</p>}
      {title && <p className="card-title">{title}</p>}
      {children}
    </div>
  );
}
