import type { Env } from "../env.d.ts";

function basicAuth(customerKey: string, customerSecret: string): string {
  return btoa(`${customerKey}:${customerSecret}`);
}

function agoraRestHeaders(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${basicAuth(env.AGORA_CUSTOMER_KEY, env.AGORA_CUSTOMER_SECRET)}`,
  };
}

// ─── Cloud Recording ────────────────────────────────────────────

export async function acquireRecordingResource(
  env: Env,
  channelName: string,
  uid: string
): Promise<{ resourceId: string }> {
  const res = await fetch(
    `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}/cloud_recording/acquire`,
    {
      method: "POST",
      headers: agoraRestHeaders(env),
      body: JSON.stringify({
        cname: channelName,
        uid,
        clientRequest: {
          resourceExpiredHour: 24,
          scene: 0, // composite recording
        },
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora acquire failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function startRecording(
  env: Env,
  resourceId: string,
  channelName: string,
  uid: string,
  token: string,
  r2Config: { accessKey: string; secretKey: string; bucket: string; endpoint: string }
): Promise<{ sid: string }> {
  const res = await fetch(
    `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
    {
      method: "POST",
      headers: agoraRestHeaders(env),
      body: JSON.stringify({
        cname: channelName,
        uid,
        clientRequest: {
          token,
          recordingConfig: {
            channelType: 1, // live broadcast
            streamTypes: 2, // audio + video
            maxIdleTime: 30,
            transcodingConfig: {
              width: 1280,
              height: 720,
              fps: 30,
              bitrate: 2260,
              mixedVideoLayout: 1, // best fit
            },
          },
          storageConfig: {
            vendor: 11, // S3-compatible (R2)
            region: 0,
            bucket: r2Config.bucket,
            accessKey: r2Config.accessKey,
            secretKey: r2Config.secretKey,
            fileNamePrefix: ["recordings", channelName],
            endpoint: r2Config.endpoint,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora start recording failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function stopRecording(
  env: Env,
  resourceId: string,
  sid: string,
  channelName: string,
  uid: string
): Promise<{ serverResponse: { fileList: unknown[] } }> {
  const res = await fetch(
    `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
    {
      method: "POST",
      headers: agoraRestHeaders(env),
      body: JSON.stringify({
        cname: channelName,
        uid,
        clientRequest: {},
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora stop recording failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function queryRecording(
  env: Env,
  resourceId: string,
  sid: string
): Promise<{ serverResponse: { status: number } }> {
  const res = await fetch(
    `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`,
    {
      method: "GET",
      headers: agoraRestHeaders(env),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora query recording failed: ${res.status} ${error}`);
  }

  return res.json();
}

// ─── Real-Time STT ──────────────────────────────────────────────

export async function startStt(
  env: Env,
  channelName: string,
  token: string,
  uid: string
): Promise<{ taskId: string }> {
  const res = await fetch(
    `https://api.agora.io/v1/projects/${env.AGORA_APP_ID}/rtsc/speech-to-text/tasks?builderToken=${token}`,
    {
      method: "POST",
      headers: agoraRestHeaders(env),
      body: JSON.stringify({
        audio: {
          subscribeSource: "AGORARTC",
          agoraRtcConfig: {
            channelName,
            uid,
            channelType: "LIVE_TYPE",
            subscribeConfig: {
              subscribeMode: "CHANNEL_MODE",
            },
            token,
          },
        },
        config: {
          features: ["RECOGNIZE"],
          recognizeConfig: {
            language: "en-US,zh-CN",
            model: "large",
            output: {
              destinations: ["AgoraRTCDataStream"],
              agoraRTCDataStream: {
                channelName,
                uid,
                token,
              },
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora STT start failed: ${res.status} ${error}`);
  }

  return res.json();
}

export async function stopStt(
  env: Env,
  taskId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `https://api.agora.io/v1/projects/${env.AGORA_APP_ID}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${token}`,
    {
      method: "DELETE",
      headers: agoraRestHeaders(env),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Agora STT stop failed: ${res.status} ${error}`);
  }
}
