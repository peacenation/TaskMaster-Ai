import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { billingEnabled, entitlementsFor } from "./plans";
import { StripeError, verifyWebhook } from "./stripe";
import { planChangeFor } from "./webhook";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("entitlements", () => {
  it("gives everyone Pro limits while there's nothing to buy", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(billingEnabled()).toBe(false);
    expect(entitlementsFor("free")).toMatchObject({ plan: "free", calendars: 5 });
  });

  it("limits Free and lifts the limits for Pro once billing is on", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_PRO = "price_x";
    process.env.AI_HOURLY_LIMIT = "10";
    process.env.AI_HOURLY_LIMIT_PRO = "60";
    expect(entitlementsFor("free")).toEqual({ plan: "free", aiPerHour: 10, calendars: 1 });
    expect(entitlementsFor("pro")).toEqual({ plan: "pro", aiPerHour: 60, calendars: 5 });
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ id: "evt_1", type: "ping", data: { object: {} } });
  const sign = (t: number, body = payload) =>
    `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  const now = 1_800_000_000_000;

  it("accepts a correctly signed, recent event", () => {
    expect(verifyWebhook(payload, sign(now / 1000), secret, now).id).toBe("evt_1");
  });

  it("rejects a forged, tampered, stale or missing signature", () => {
    expect(() => verifyWebhook(payload, "t=1,v1=deadbeef", secret, now)).toThrow(StripeError);
    expect(() =>
      verifyWebhook(payload.replace("ping", "pong"), sign(now / 1000), secret, now)
    ).toThrow(/Bad signature/);
    expect(() => verifyWebhook(payload, sign(now / 1000 - 3600), secret, now)).toThrow(
      /Stale/
    );
    expect(() => verifyWebhook(payload, null, secret, now)).toThrow(/Missing/);
  });
});

describe("planChangeFor", () => {
  it("upgrades on a completed subscription checkout", () => {
    expect(
      planChangeFor({
        type: "checkout.session.completed",
        data: {
          object: { mode: "subscription", client_reference_id: "u1", customer: "cus_1" },
        },
      })
    ).toEqual({
      userId: "u1",
      customerId: "cus_1",
      plan: "pro",
      status: "active",
      renewsAt: null,
    });
  });

  it("keeps Pro while a payment is retried, and returns to Free when it ends", () => {
    const sub = (type: string, status: string) =>
      planChangeFor({
        type,
        data: {
          object: {
            status,
            customer: "cus_1",
            metadata: { user_id: "u1" },
            current_period_end: 1_800_000_000,
          },
        },
      });
    expect(sub("customer.subscription.updated", "past_due")).toMatchObject({ plan: "pro" });
    expect(sub("customer.subscription.updated", "unpaid")).toMatchObject({ plan: "free" });
    expect(sub("customer.subscription.deleted", "active")).toMatchObject({
      plan: "free",
      status: "canceled",
      renewsAt: new Date(1_800_000_000_000),
    });
  });

  it("ignores events it doesn't need", () => {
    expect(planChangeFor({ type: "invoice.paid", data: { object: {} } })).toBeNull();
    expect(
      planChangeFor({
        type: "checkout.session.completed",
        data: { object: { mode: "payment" } },
      })
    ).toBeNull();
  });
});
