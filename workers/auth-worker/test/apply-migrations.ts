import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.AUTH_DB, env.TEST_MIGRATIONS);
await applyD1Migrations(env.EVENTS_DB, env.TEST_EVENTS_MIGRATIONS);
