export interface RealityCheckSummary {
  workMinutes: number;
  usableMinutes: number;
  excessMinutes: number;
}

export function realityCheckSummary(
  workMinutes: number,
  usableMinutes: number
): RealityCheckSummary | null {
  if (workMinutes <= usableMinutes) return null;
  return {
    workMinutes,
    usableMinutes,
    excessMinutes: workMinutes - usableMinutes,
  };
}