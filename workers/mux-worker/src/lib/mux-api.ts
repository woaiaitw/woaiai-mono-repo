import type { Env } from "../env.d.ts";

const MUX_BASE = "https://api.mux.com";

function authHeaders(env: Env): HeadersInit {
  const encoded = btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

export interface MuxLiveStream {
  id: string;
  stream_key: string;
  status: "idle" | "active" | "disabled";
  playback_ids: Array<{ id: string; policy: string }>;
  recent_asset_ids?: string[];
  created_at: string;
}

export interface MuxAsset {
  id: string;
  status: string;
  playback_ids: Array<{ id: string; policy: string }>;
  duration?: number;
}

/** Create a new live stream with public playback and auto-generated English captions */
export async function createLiveStream(env: Env): Promise<MuxLiveStream> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify({
      playback_policies: ["public"],
      new_asset_settings: { playback_policies: ["public"] },
      generated_subtitles: [{ language_code: "en", name: "English CC" }],
      reduced_latency: true,
      ...(env.ENVIRONMENT === "development" && { test: true }),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux create stream failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data: MuxLiveStream };
  return data.data;
}

/** Get live stream status */
export async function getLiveStream(
  env: Env,
  streamId: string
): Promise<MuxLiveStream> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams/${streamId}`, {
    headers: authHeaders(env),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux get stream failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data: MuxLiveStream };
  return data.data;
}

/** List all live streams */
export async function listLiveStreams(env: Env): Promise<MuxLiveStream[]> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams?limit=10`, {
    headers: authHeaders(env),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux list streams failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data: MuxLiveStream[] };
  return data.data;
}

/** End (complete) a live stream */
export async function completeLiveStream(
  env: Env,
  streamId: string
): Promise<void> {
  const res = await fetch(
    `${MUX_BASE}/video/v1/live-streams/${streamId}/complete`,
    {
      method: "PUT",
      headers: authHeaders(env),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux complete stream failed: ${res.status} ${text}`);
  }
}

/** Delete a live stream */
export async function deleteLiveStream(
  env: Env,
  streamId: string
): Promise<void> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams/${streamId}`, {
    method: "DELETE",
    headers: authHeaders(env),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux delete stream failed: ${res.status} ${text}`);
  }
}

/** Get an asset by ID */
export async function getAsset(env: Env, assetId: string): Promise<MuxAsset> {
  const res = await fetch(`${MUX_BASE}/video/v1/assets/${assetId}`, {
    headers: authHeaders(env),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux get asset failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data: MuxAsset };
  return data.data;
}

/** Reset stream key (security rotation) */
export async function resetStreamKey(
  env: Env,
  streamId: string
): Promise<MuxLiveStream> {
  const res = await fetch(
    `${MUX_BASE}/video/v1/live-streams/${streamId}/reset-stream-key`,
    {
      method: "POST",
      headers: authHeaders(env),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux reset key failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data: MuxLiveStream };
  return data.data;
}
