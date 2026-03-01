import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const streamingEvents = sqliteTable("streaming_event", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("upcoming"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});
