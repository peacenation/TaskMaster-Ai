import type { PlanId } from "./plans";

// What a Stripe event means for a user's plan. Pure, so it's tested
// without Stripe; app/api/billing/webhook applies the result.

export interface PlanChange {
  userId: string | null;
  customerId: string | null;
  plan: PlanId;
  status: string;
  renewsAt: Date | null;
}

/** Subscriptions in these states keep Pro (past_due: Stripe is retrying). */
const PAID = new Set(["active", "trialing", "past_due"]);

export function planChangeFor(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): PlanChange | null {
  const object = event.data.object;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  switch (event.type) {
    case "checkout.session.completed":
      if (object.mode !== "subscription") return null;
      return {
        userId: str(object.client_reference_id),
        customerId: str(object.customer),
        plan: "pro",
        status: "active",
        renewsAt: null,
      };
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const status = event.type.endsWith("deleted") ? "canceled" : (str(object.status) ?? "");
      const metadata = (object.metadata ?? {}) as Record<string, unknown>;
      const end =
        object.current_period_end ??
        (object.items as { data?: Array<{ current_period_end?: number }> })?.data?.[0]
          ?.current_period_end;
      return {
        userId: str(metadata.user_id),
        customerId: str(object.customer),
        plan: PAID.has(status) ? "pro" : "free",
        status,
        renewsAt: typeof end === "number" ? new Date(end * 1000) : null,
      };
    }
    default:
      return null;
  }
}
