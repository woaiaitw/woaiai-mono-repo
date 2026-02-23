import type { Stream, TokenResponse } from "@web-template/shared";

const VIDEO_WORKER_URL =
  import.meta.env.VITE_VIDEO_WORKER_URL ?? "http://localhost:8789";

async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${VIDEO_WORKER_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as { error: string }).error ?? res.statusText);
  }
  return res.json();
}

// ─── Stream API ─────────────────────────────────────────────────

export async function createStream(data: {
  title: string;
  description?: string;
  scheduledAt: string;
  hostUserId: string;
}): Promise<Stream> {
  return fetchJson("/api/streams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listStreams(): Promise<Stream[]> {
  return fetchJson("/api/streams");
}

export async function getStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}`);
}

export async function getStreamBySlug(slug: string): Promise<Stream> {
  return fetchJson(`/api/streams/by-slug/${slug}`);
}

export async function updateStream(
  id: string,
  data: Partial<Pick<Stream, "title" | "description" | "scheduledAt" | "hostUserId">>
): Promise<Stream> {
  return fetchJson(`/api/streams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}`, { method: "DELETE" });
}

export async function publishStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}/publish`, { method: "POST" });
}

export async function goLive(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}/go-live`, { method: "POST" });
}

export async function endStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}/end`, { method: "POST" });
}

export async function pauseStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}/pause`, { method: "POST" });
}

export async function resumeStream(id: string): Promise<Stream> {
  return fetchJson(`/api/streams/${id}/resume`, { method: "POST" });
}

// ─── Token API ──────────────────────────────────────────────────

export async function getViewerToken(channel: string): Promise<TokenResponse> {
  return fetchJson(`/api/tokens/viewer?channel=${encodeURIComponent(channel)}`);
}

export async function getHostToken(streamId: string): Promise<TokenResponse> {
  return fetchJson(`/api/tokens/host?stream=${encodeURIComponent(streamId)}`);
}

export async function getSpeakerToken(streamId: string): Promise<TokenResponse> {
  return fetchJson(`/api/tokens/speaker?stream=${encodeURIComponent(streamId)}`);
}

export async function getScreenShareToken(
  streamId: string,
  cameraUid: number
): Promise<TokenResponse> {
  return fetchJson(
    `/api/tokens/screen?stream=${encodeURIComponent(streamId)}&cameraUid=${cameraUid}`
  );
}

// ─── Hand Raise API ─────────────────────────────────────────────

export async function raiseHand(
  streamId: string,
  uid: number,
  name: string
): Promise<void> {
  await fetchJson(`/api/streams/${streamId}/hand-raise`, {
    method: "POST",
    body: JSON.stringify({ uid, name }),
  });
}

export async function lowerHand(streamId: string): Promise<void> {
  await fetchJson(`/api/streams/${streamId}/hand-raise`, { method: "DELETE" });
}

export async function getHandRaises(
  streamId: string
): Promise<{ uid: number; name: string; userId: string; raisedAt: number }[]> {
  return fetchJson(`/api/streams/${streamId}/hand-raises`);
}

// ─── Recording API ──────────────────────────────────────────────

export async function startRecording(streamId: string): Promise<unknown> {
  return fetchJson("/api/recording/start", {
    method: "POST",
    body: JSON.stringify({ streamId }),
  });
}

export async function stopRecording(streamId: string): Promise<unknown> {
  return fetchJson("/api/recording/stop", {
    method: "POST",
    body: JSON.stringify({ streamId }),
  });
}

export async function getRecordings(streamId: string): Promise<unknown[]> {
  return fetchJson(`/api/recording/${streamId}`);
}

export async function getRecordingUrl(
  streamId: string
): Promise<{ downloadUrl: string }> {
  return fetchJson(`/api/recording/${streamId}/url`);
}

// ─── STT API ────────────────────────────────────────────────────

export async function startStt(streamId: string): Promise<{ taskId: string }> {
  return fetchJson("/api/stt/start", {
    method: "POST",
    body: JSON.stringify({ streamId }),
  });
}

export async function stopStt(streamId: string): Promise<void> {
  await fetchJson("/api/stt/stop", {
    method: "POST",
    body: JSON.stringify({ streamId }),
  });
}
