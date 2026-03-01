import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../env.d.ts";

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
