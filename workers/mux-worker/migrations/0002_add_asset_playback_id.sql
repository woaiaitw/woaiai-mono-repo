-- Add column to store the VOD asset's playback ID for replay
ALTER TABLE streams ADD COLUMN mux_asset_playback_id TEXT;
