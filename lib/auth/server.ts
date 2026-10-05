import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { getAuthDb } from "@/lib/db/client";
import { authSchema } from "@/lib/db/auth-schema";
import { withRepositories } from "@/lib/repo";
import { getEmailProvider } from "./email";

export function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
    throw new Error("Configure BETTER_AUTH_SECRET with at least 32 random characters.");
  return betterAuth({
    appName: "TaskMaster",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getAuthDb(), {
      provider: "pg",
      schema: authSchema,
      transaction: true,
    }),
    advanced: { database: { generateId: () => randomUUID() } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        getEmailProvider().send({
          to: user.email,
          subject: "Reset your TaskMaster password",
          text: `Reset your password using this link:\n${url}\n\nIf you did not request this, ignore this email.`,
        }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Off: a cached session cookie stays valid for its whole maxAge after
      // sign-out, password reset, or account deletion. Revocation must be
      // immediate (PRD §1.11), so every session check reads the database.
      cookieCache: { enabled: false },
    },
    user: { deleteUser: { enabled: true } },
    // On everywhere by default (Better Auth only enables it in production
    // otherwise), counted in the database so the limit holds across
    // serverless instances. AUTH_RATE_LIMIT=off exists for the e2e server
    // only, where every test signs up from the same address.
    rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off", storage: "database" },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await withRepositories(user.id, (repos) =>
              repos.users.ensure({ name: user.name, email: user.email, authId: user.id })
            );
          },
        },
      },
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) =>
          getEmailProvider().send({
            to: email,
            subject: "Sign in to TaskMaster",
            text: `Sign in using this link:\n${url}\n\nIf you did not request this, ignore this email.`,
          }),
      }),
      nextCookies(),
    ],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
