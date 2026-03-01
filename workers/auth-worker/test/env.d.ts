import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    AUTH_DB: D1Database;
    EVENTS_DB: D1Database;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    WEB_URL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    TEST_MIGRATIONS: D1Migration[];
    TEST_EVENTS_MIGRATIONS: D1Migration[];
  }
}
