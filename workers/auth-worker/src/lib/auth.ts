import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../env.d.ts";

// Captured magic link URLs keyed by email, used by the speaker-invite
// endpoint to return the generated URL to the admin.
export const capturedMagicLinkUrls = new Map<string, string>();

// ---------------------------------------------------------------------------
// PBKDF2 password hashing (Workers-compatible, uses Web Crypto API)
//
// Default better-auth uses scrypt which exceeds Cloudflare Workers' CPU
// time limit. PBKDF2-SHA256 is hardware-accelerated in Workers and stays
// well within the 10 ms budget.
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LENGTH * 8,
  );
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = [...new Uint8Array(derived)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [saltHex, storedHashHex] = hash.split(":");
  if (!saltHex || !storedHashHex) return false;
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LENGTH * 8,
  );
  const computedHex = [...new Uint8Array(derived)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === storedHashHex;
}

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
      password: { hash: hashPassword, verify: verifyPassword },
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
