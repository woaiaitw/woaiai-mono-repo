CREATE TABLE streams (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  mux_stream_id   TEXT,
  mux_playback_id TEXT,
  mux_stream_key  TEXT,
  mux_asset_id    TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at        TEXT
);

CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streams_scheduled_at ON streams(scheduled_at);
CREATE INDEX idx_streams_mux_stream_id ON streams(mux_stream_id);
