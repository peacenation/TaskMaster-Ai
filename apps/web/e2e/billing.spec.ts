import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// Billing: only a correctly signed Stripe webhook changes a plan.

const BASE = "http://localhost:3110";
const SECRET = "whsec_e2e"; // scripts/e2e-server.mjs

function signed(event: object, secret = SECRET) {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return fetch(`${BASE}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${v1}` },
    body,
  });
}

test("billing: a signed webhook upgrades and cancels; forgeries change nothing", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const email = uniqueEmail("billing", info.project.name);
  await createConfirmedUser(email, "Ada Lovelace");
  const { url, publishableKey } = localSupabase();
  const phone = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data } = await phone.auth.signInWithPassword({ email, password: PASSWORD });
  const token = data.session!.access_token;
  const me = async () =>
    (
      await (
        await fetch(`${BASE}/api/v1/me`, { headers: { authorization: `Bearer ${token}` } })
      ).json()
    ).plan;
  const { id: userIdPlan } = await me();
  expect(userIdPlan).toBe("free");
  const userId = (
    await (
      await fetch(`${BASE}/api/v1/me`, { headers: { authorization: `Bearer ${token}` } })
    ).json()
  ).id;

  const checkout = {
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        mode: "subscription",
        client_reference_id: userId,
        customer: `cus_${Date.now()}`,
      },
    },
  };
  // Forged (wrong secret) and unsigned events are refused.
  expect((await signed(checkout, "whsec_wrong")).status).toBe(400);
  expect(
    (
      await fetch(`${BASE}/api/billing/webhook`, {
        method: "POST",
        body: JSON.stringify(checkout),
      })
    ).status
  ).toBe(400);
  expect((await me()).id).toBe("free");

  expect((await signed(checkout)).status).toBe(200);
  expect(await me()).toMatchObject({ id: "pro", status: "active" });

  const renews = Math.floor(Date.now() / 1000) + 30 * 86400;
  expect(
    (
      await signed({
        id: "evt_deleted",
        type: "customer.subscription.deleted",
        data: {
          object: {
            status: "canceled",
            customer: checkout.data.object.customer,
            metadata: { user_id: userId },
            current_period_end: renews,
          },
        },
      })
    ).status
  ).toBe(200);
  expect(await me()).toMatchObject({ id: "free", status: "canceled" });

  // The user can't upgrade themselves through preferences.
  await fetch(`${BASE}/api/v1/me`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ plan: "pro" }),
  });
  expect((await me()).id).toBe("free");
});

test("pricing page is public and honest about billing being off", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(
    page.getByText("Coming soon. Every account has Pro limits until then.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
});
