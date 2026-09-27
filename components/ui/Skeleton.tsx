export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", className }: SkeletonProps) {
  const classes = ["skeleton", className].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      style={{ width, height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}
