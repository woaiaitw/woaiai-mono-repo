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
              BETTER_AUTH_SECRET: "test-secret-for-vitest",
              BETTER_AUTH_URL: "http://localhost:8788",
              WEB_URL: "http://localhost:3000",
              GOOGLE_CLIENT_ID: "test-google-client-id",
              GOOGLE_CLIENT_SECRET: "test-google-client-secret",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
