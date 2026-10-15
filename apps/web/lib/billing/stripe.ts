import { createHmac, timingSafeEqual } from "node:crypto";

// A small Stripe client over its REST API: Checkout to subscribe, the
// Customer Portal to manage or cancel, and webhook signature checks. No
// SDK — three endpoints don't need one.

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {}

function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Billing isn't configured.");
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) throw new StripeError(body.error?.message ?? "Stripe request failed.");
  return body;
}

/** A hosted Checkout page for the Pro subscription. */
export async function createCheckout(input: {
  userId: string;
  email: string;
  customerId: string | null;
  origin: string;
}): Promise<string> {
  const session = await call<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PRICE_PRO!,
    "line_items[0][quantity]": "1",
    client_reference_id: input.userId,
    "subscription_data[metadata][user_id]": input.userId,
    ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
    allow_promotion_codes: "true",
    success_url: `${input.origin}/settings?billing=success`,
    cancel_url: `${input.origin}/pricing`,
  });
  return session.url;
}

/** The Customer Portal: change card, see invoices, cancel. */
export async function createPortal(customerId: string, origin: string): Promise<string> {
  const session = await call<{ url: string }>("/billing_portal/sessions", {
    customer: customerId,
    return_url: `${origin}/settings`,
  });
  return session.url;
}

/** Tolerance for webhook timestamps, against replays. */
const TOLERANCE_S = 300;

/**
 * Verify a webhook's Stripe-Signature header (HMAC-SHA256 of
 * "timestamp.payload" with the endpoint secret) and return the event.
 */
export function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now()
): { id: string; type: string; data: { object: Record<string, unknown> } } {
  if (!header) throw new StripeError("Missing signature.");
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, ...v] = part.split("=");
      return [k, v.join("=")];
    })
  );
  const signatures = header
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || signatures.length === 0) throw new StripeError("Malformed signature.");
  if (Math.abs(now / 1000 - timestamp) > TOLERANCE_S)
    throw new StripeError("Stale signature.");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const ok = signatures.some(
    (sig) =>
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  );
  if (!ok) throw new StripeError("Bad signature.");
  return JSON.parse(payload);
}
