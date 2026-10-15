// Free and Pro (PRD §5.1). Free shows the whole core loop; Pro does more
// of it automatically. Limits are enforced on the server, never trusted
// from a client. Until Stripe is configured there's nothing to buy, so
// everyone gets Pro limits rather than a paywall with no way through.

export type PlanId = "free" | "pro";

export interface Entitlements {
  plan: PlanId;
  /** Claude calls (Brain Dump organising, AI Planner) per rolling hour. */
  aiPerHour: number;
  /** Connected calendars. */
  calendars: number;
}

export function billingEnabled(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
}

const freeAi = () => Number(process.env.AI_HOURLY_LIMIT) || 30;
const proAi = () => Number(process.env.AI_HOURLY_LIMIT_PRO) || 120;

export function entitlementsFor(plan: PlanId): Entitlements {
  const effective: PlanId = billingEnabled() ? plan : "pro";
  return effective === "pro"
    ? { plan, aiPerHour: proAi(), calendars: 5 }
    : { plan, aiPerHour: freeAi(), calendars: 1 };
}

/** What each plan offers, for the pricing page and Settings. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    "Brain Dump with AI organising (fair hourly limit)",
    "Today, Next Best Action and Focus",
    "Projects, goals, responsibilities and reviews",
    "One connected calendar",
    "Web and mobile, synced",
  ],
  pro: [
    "Everything in Free",
    "Four times the AI organising and planning",
    "Up to five connected calendars",
    "AI Planner for your whole day",
    "Priority support",
  ],
};

/** e.g. "£4 / month" — set PRO_PRICE_LABEL to match the Stripe price. */
export const proPriceLabel = () => process.env.PRO_PRICE_LABEL || "Pro";
