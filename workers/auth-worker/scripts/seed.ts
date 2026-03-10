/**
 * Seed script for local development.
 *
 * Prerequisites: the auth-worker must be running locally (`pnpm dev`),
 * and the D1 migration must have been applied (`pnpm db:migrate:local`).
 *
 * Usage: pnpm db:seed  (from workers/auth-worker)
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workerRoot = resolve(__dirname, "..");

const AUTH_URL = "http://localhost:8788";

const SEED_USERS = [
  { email: "owner@example.com", name: "Owner", role: "owner" },
  { email: "admin@example.com", name: "Admin", role: "admin" },
  { email: "speaker@example.com", name: "Speaker", role: "speaker" },
  { email: "user@example.com", name: "User", role: "user" },
] as const;

const PASSWORD = "password";

async function seed() {
  console.log("Seeding local dev users...\n");

  for (const user of SEED_USERS) {
    const signUpRes = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
      body: JSON.stringify({
        email: user.email,
        password: PASSWORD,
        name: user.name,
      }),
    });

    if (!signUpRes.ok) {
      const body = await signUpRes.text();
      if (body.includes("already") || body.includes("exists")) {
        console.log(`  [skip] ${user.email} already exists`);
      } else {
        console.error(`  [error] Failed to create ${user.email}: ${body}`);
        continue;
      }
    } else {
      console.log(`  [created] ${user.email}`);
    }
  }

  console.log("\nUpdating roles via D1...\n");

  for (const user of SEED_USERS) {
    const sql = `UPDATE user SET role = '${user.role}' WHERE email = '${user.email}';`;
    try {
      execSync(
        `npx wrangler d1 execute AUTH_DB --local --command="${sql}"`,
        { cwd: workerRoot, stdio: "pipe" }
      );
      console.log(`  [role] ${user.email} -> ${user.role}`);
    } catch (err) {
      console.error(`  [error] Failed to set role for ${user.email}:`, err);
    }
  }

  console.log("\nDone! Seeded users:");
  for (const user of SEED_USERS) {
    console.log(`  ${user.email} (${user.role}) — password: ${PASSWORD}`);
  }
}

seed().catch(console.error);
