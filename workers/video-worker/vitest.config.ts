import {
  defineWorkersProject,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersProject(async () => {
  const migrationsPath = path.join(__dirname, "drizzle");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      globals: true,
      poolOptions: {
        workers: {
          main: "./src/index.ts",
          wrangler: {
            configPath: "./wrangler.toml",
          },
          miniflare: {
            bindings: {
              WEB_URL: "http://localhost:3000",
              AUTH_WORKER_URL: "http://localhost:8788",
              AGORA_APP_ID: "970ca35de60c44645bbae8a215061b33",
              AGORA_APP_CERTIFICATE: "5cfd2fd1755d40ecb72977518be15d3b",
              AGORA_CUSTOMER_KEY: "test-customer-key",
              AGORA_CUSTOMER_SECRET: "test-customer-secret",
              TEST_AUTH_USER: JSON.stringify({
                id: "test-user-1",
                name: "Test User",
                email: "test@example.com",
              }),
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
