import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

// ─── Streams ────────────────────────────────────────────────────

export const stream = sqliteTable("stream", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status")
    .notNull()
    .$type<
      | "draft"
      | "scheduled"
      | "pre_stream"
      | "live"
      | "paused"
      | "ending"
      | "processing"
      | "completed"
      | "cancelled"
    >(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  hostUserId: text("host_user_id").notNull(),
  hostName: text("host_name"),
  agoraChannelName: text("agora_channel_name").notNull().unique(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ─── Participants ───────────────────────────────────────────────

export const participant = sqliteTable("participant", {
  id: text("id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => stream.id),
  userId: text("user_id"),
  agoraUid: integer("agora_uid").notNull(),
  role: text("role")
    .notNull()
    .$type<"host" | "speaker" | "admin" | "viewer">(),
  joinedAt: integer("joined_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  leftAt: integer("left_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ─── Recordings ─────────────────────────────────────────────────

export const recording = sqliteTable("recording", {
  id: text("id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => stream.id),
  agoraResourceId: text("agora_resource_id"),
  agoraSid: text("agora_sid"),
  status: text("status")
    .notNull()
    .$type<"recording" | "processing" | "ready" | "failed">(),
  r2Key: text("r2_key"),
  fileSize: integer("file_size"),
  duration: integer("duration"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  stoppedAt: integer("stopped_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ─── Transcripts ────────────────────────────────────────────────

export const transcript = sqliteTable("transcript", {
  id: text("id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => stream.id),
  language: text("language").notNull(),
  format: text("format")
    .notNull()
    .$type<"vtt" | "srt" | "json">(),
  r2Key: text("r2_key"),
  isTranslation: integer("is_translation", { mode: "boolean" })
    .notNull()
    .default(false),
  sourceTranscriptId: text("source_transcript_id").references(
    (): AnySQLiteColumn => transcript.id
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});
