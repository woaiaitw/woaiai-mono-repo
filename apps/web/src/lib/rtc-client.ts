import type { JoinResponse, ParticipantRole } from "@web-template/shared";

const RTC_BASE =
  import.meta.env.VITE_RTC_WORKER_URL ?? "http://localhost:8789";

const SESSION_ID_KEY = "rtc-session-id";

/** Get or create a persistent session ID for this browser */
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export async function createMeeting(): Promise<{ meetingId: string }> {
  const res = await fetch(`${RTC_BASE}/api/rtc/meeting`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to create meeting");
  return res.json();
}

export async function joinMeeting(
  role: ParticipantRole,
  name?: string,
  signal?: AbortSignal
): Promise<JoinResponse> {
  const sessionId = role === "host" ? "host" : getSessionId();
  const body = { role, name, sessionId };
  console.log("[RTK-DEBUG] rtc-client joinMeeting request:", body);
  const res = await fetch(`${RTC_BASE}/api/rtc/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[RTK-DEBUG] rtc-client joinMeeting FAILED: status=%d body=%s", res.status, text);
    throw new Error("Failed to join meeting");
  }
  const result: JoinResponse = await res.json();
  console.log("[RTK-DEBUG] rtc-client joinMeeting response:", { meetingId: result.meetingId, participantId: result.participantId });
  return result;
}

export function getCaptionWsUrl(): string {
  const base = RTC_BASE.replace(/^http/, "ws");
  return `${base}/api/rtc/ws`;
}
