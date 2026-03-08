import type { MuxStreamInfo, MuxStreamListItem } from "@web-template/shared";

const MUX_BASE =
  import.meta.env.VITE_MUX_WORKER_URL ?? "http://localhost:8790";

/** Create a new Mux live stream */
export async function createStream(): Promise<MuxStreamInfo> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to create stream");
  return res.json();
}

/** Get stream status */
export async function getStream(streamId: string): Promise<MuxStreamInfo> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get stream");
  return res.json();
}

/** List all streams */
export async function listStreams(): Promise<MuxStreamListItem[]> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to list streams");
  const data = await res.json();
  return data.streams;
}

/** End a stream */
export async function completeStream(streamId: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}/complete`, {
    method: "PUT",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to end stream");
}

/** Delete a stream */
export async function deleteStream(streamId: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/api/mux/streams/${streamId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete stream");
}
