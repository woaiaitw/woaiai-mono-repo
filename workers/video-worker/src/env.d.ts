export interface Env {
  VIDEO_DB: D1Database;
  RECORDINGS_BUCKET: R2Bucket;
  WEB_URL: string;
  AUTH_WORKER_URL: string;
  AGORA_APP_ID: string;
  AGORA_APP_CERTIFICATE: string;
  AGORA_CUSTOMER_KEY: string;
  AGORA_CUSTOMER_SECRET: string;
  // Test-only: JSON-encoded user object to bypass auth in vitest
  TEST_AUTH_USER?: string;
}
