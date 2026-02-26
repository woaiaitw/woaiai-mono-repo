import type { Env } from "../env.d.ts";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function getHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function createMeeting(
  env: Env,
  title: string = "Broadcast Room"
) {
  const res = await fetch(
    `${CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/realtime/kit/${env.REALTIME_APP_ID}/meetings`,
    {
      method: "POST",
      headers: getHeaders(env),
      body: JSON.stringify({ title }),
    }
  );

  const text = await res.text();
  console.log("[RTC-DEBUG] CF createMeeting response:", res.status, text);

  if (!res.ok) {
    throw new Error(`Failed to create meeting: ${res.status} ${text}`);
  }

  const json = JSON.parse(text) as {
    success: boolean;
    data: { id: string };
  };
  return json.data;
}

export async function addParticipant(
  env: Env,
  meetingId: string,
  opts: { name: string; presetName: string; customParticipantId: string }
) {
  const res = await fetch(
    `${CF_API_BASE}/accounts/${env.CF_ACCOUNT_ID}/realtime/kit/${env.REALTIME_APP_ID}/meetings/${meetingId}/participants`,
    {
      method: "POST",
      headers: getHeaders(env),
      body: JSON.stringify({
        name: opts.name,
        preset_name: opts.presetName,
        custom_participant_id: opts.customParticipantId,
      }),
    }
  );

  const text = await res.text();
  console.log("[RTC-DEBUG] CF addParticipant response:", res.status, text);

  if (!res.ok) {
    throw new Error(`Failed to add participant: ${res.status} ${text}`);
  }

  const json = JSON.parse(text) as {
    success: boolean;
    data: { id: string; token: string };
  };
  return {
    participantId: json.data.id,
    authToken: json.data.token,
  };
}
