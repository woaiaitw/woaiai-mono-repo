import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../env.d.ts";

// Captured magic link URLs keyed by email, used by the speaker-invite
// endpoint to return the generated URL to the admin.
export const capturedMagicLinkUrls = new Map<string, string>();

export function getAuth(env: Env) {
  const db = drizzle(env.AUTH_DB);
  const isLocal = env.WEB_URL?.includes("localhost");

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          capturedMagicLinkUrls.set(email, url);
        },
      }),
    ],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: [env.WEB_URL],
    advanced: {
      defaultCookieAttributes: isLocal
        ? {
            secure: false,
            httpOnly: true,
            sameSite: "lax" as const,
          }
        : {
            secure: true,
            httpOnly: true,
            sameSite: "none" as const,
            partitioned: true,
          },
    },
  });
}
