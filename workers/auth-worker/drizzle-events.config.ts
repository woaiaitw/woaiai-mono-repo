import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/events-schema.ts",
  out: "./drizzle-events",
  dialect: "sqlite",
});
