import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    VIDEO_DB: D1Database;
    RECORDINGS_BUCKET: R2Bucket;
    WEB_URL: string;
    AUTH_WORKER_URL: string;
    AGORA_APP_ID: string;
    AGORA_APP_CERTIFICATE: string;
    AGORA_CUSTOMER_KEY: string;
    AGORA_CUSTOMER_SECRET: string;
    TEST_AUTH_USER: string;
    TEST_MIGRATIONS: D1Migration[];
  }
}
