import type {
  MuxStreamInfo,
  MuxStreamListItem,
  StreamEvent,
  StreamEventHost,
} from "@web-template/shared";
import { authClient } from "./auth-client";

const MUX_BASE =
  import.meta.env.VITE_MUX_WORKER_URL ?? "http://localhost:8790";

/** Build headers with auth token for cross-origin worker requests */
async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  try {
    const session = await authClient.getSession();
    const token = session.data?.session?.token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    // no session — continue without token
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Legacy Mux proxy (direct stream creation)
// ---------------------------------------------------------------------------

export async function createStream(): Promise<MuxStreamInfo> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to create stream");
  return res.json();
}

export async function getStream(streamId: string): Promise<MuxStreamInfo> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get stream");
  return res.json();
}

export async function listStreams(): Promise<MuxStreamListItem[]> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to list streams");
  const data = await res.json();
  return data.streams;
}

export async function completeStream(streamId: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}/complete`, {
    method: "PUT",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to end stream");
}

export async function deleteStream(streamId: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete stream");
}

// ---------------------------------------------------------------------------
// Stream Events API (D1-backed, owner/admin = host privileges)
// ---------------------------------------------------------------------------

export async function scheduleEvent(params: {
  title: string;
  description?: string;
  scheduled_at: string;
}): Promise<StreamEvent> {
  const res = await fetch(`${MUX_BASE}/api/mux/events`, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to schedule stream");
  return res.json();
}

export async function listEvents(status?: string[]): Promise<StreamEvent[]> {
  const query = status ? `?status=${status.join(",")}` : "";
  const res = await fetch(`${MUX_BASE}/api/mux/events${query}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to list events");
  const data = await res.json();
  return data.streams;
}

export async function getEvent(id: string): Promise<StreamEvent> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get event");
  return res.json();
}

export async function getEventHost(id: string): Promise<StreamEventHost> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}/host`, {
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get host details");
  return res.json();
}

export async function provisionEvent(id: string): Promise<StreamEventHost> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}/provision`, {
    method: "PUT",
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to provision stream");
  return res.json();
}

export async function goLive(id: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}/go-live`, {
    method: "PUT",
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to go live");
}

export async function endEvent(id: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}/end`, {
    method: "PUT",
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to end stream");
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete event");
}

export async function resetEventKey(
  id: string
): Promise<{ streamKey: string }> {
  const res = await fetch(`${MUX_BASE}/api/mux/events/${id}/reset-key`, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to reset stream key");
  return res.json();
}
