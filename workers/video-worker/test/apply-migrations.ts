import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.VIDEO_DB, env.TEST_MIGRATIONS);
