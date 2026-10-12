import { ReactNode } from "react";

export type BadgeTone = "neutral" | "ai" | "success" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
