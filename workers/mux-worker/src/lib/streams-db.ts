import type { Env } from "../env.d.ts";

export interface StreamRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: "scheduled" | "preview" | "live" | "ended";
  mux_stream_id: string | null;
  mux_playback_id: string | null;
  mux_stream_key: string | null;
  mux_asset_id: string | null;
  created_by: string;
  created_at: string;
  ended_at: string | null;
}

export async function createStream(
  db: D1Database,
  params: { id: string; title: string; description?: string; scheduled_at: string; created_by: string }
): Promise<StreamRow> {
  await db
    .prepare(
      `INSERT INTO streams (id, title, description, scheduled_at, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(params.id, params.title, params.description ?? null, params.scheduled_at, params.created_by)
    .run();

  return (await getStream(db, params.id))!;
}

export async function getStream(db: D1Database, id: string): Promise<StreamRow | null> {
  return db.prepare("SELECT * FROM streams WHERE id = ?").bind(id).first<StreamRow>();
}

export async function getStreamByMuxId(db: D1Database, muxStreamId: string): Promise<StreamRow | null> {
  return db
    .prepare("SELECT * FROM streams WHERE mux_stream_id = ?")
    .bind(muxStreamId)
    .first<StreamRow>();
}

export async function listStreams(
  db: D1Database,
  statusFilter?: string[]
): Promise<StreamRow[]> {
  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT * FROM streams WHERE status IN (${placeholders})
         ORDER BY
           CASE status
             WHEN 'live' THEN 0
             WHEN 'preview' THEN 1
             WHEN 'scheduled' THEN 2
             WHEN 'ended' THEN 3
           END,
           scheduled_at ASC`
      )
      .bind(...statusFilter)
      .all<StreamRow>();
    return result.results;
  }

  const result = await db
    .prepare(
      `SELECT * FROM streams
       ORDER BY
         CASE status
           WHEN 'live' THEN 0
           WHEN 'preview' THEN 1
           WHEN 'scheduled' THEN 2
           WHEN 'ended' THEN 3
         END,
         scheduled_at ASC`
    )
    .all<StreamRow>();
  return result.results;
}

export async function updateStreamMuxIds(
  db: D1Database,
  id: string,
  muxStreamId: string,
  muxPlaybackId: string,
  muxStreamKey: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE streams SET mux_stream_id = ?, mux_playback_id = ?, mux_stream_key = ? WHERE id = ?"
    )
    .bind(muxStreamId, muxPlaybackId, muxStreamKey, id)
    .run();
}

export async function updateStreamStatus(
  db: D1Database,
  id: string,
  status: StreamRow["status"],
  endedAt?: string
): Promise<void> {
  if (endedAt) {
    await db
      .prepare("UPDATE streams SET status = ?, ended_at = ? WHERE id = ?")
      .bind(status, endedAt, id)
      .run();
  } else {
    await db.prepare("UPDATE streams SET status = ? WHERE id = ?").bind(status, id).run();
  }
}

export async function updateStreamAsset(
  db: D1Database,
  muxStreamId: string,
  muxAssetId: string
): Promise<void> {
  await db
    .prepare("UPDATE streams SET mux_asset_id = ? WHERE mux_stream_id = ?")
    .bind(muxAssetId, muxStreamId)
    .run();
}

export async function updateStreamKey(
  db: D1Database,
  id: string,
  muxStreamKey: string
): Promise<void> {
  await db
    .prepare("UPDATE streams SET mux_stream_key = ? WHERE id = ?")
    .bind(muxStreamKey, id)
    .run();
}

export async function deleteStream(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM streams WHERE id = ?").bind(id).run();
}
