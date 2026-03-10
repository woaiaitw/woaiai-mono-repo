import type { CaptionMessage } from "@web-template/shared";

interface DeepgramResult {
  type: string;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
    detected_language?: string;
  };
  is_final?: boolean;
}

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  DEEPGRAM_API_KEY: string;
}

// CF Workers fetch() requires https:// with Upgrade header, not wss://
const MAX_AUDIO_BUFFER = 50;

/**
 * CaptionRoom Durable Object — uses the Hibernation API so WebSocket
 * messages are delivered through class methods (webSocketMessage, etc.)
 * rather than addEventListener.
 */
export class CaptionRoom {
  private state: DurableObjectState;
  private env: Env;
  private deepgramWs: WebSocket | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private audioBuffer: ArrayBuffer[] = [];
  private language = "en";
  private audioChunkCount = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Meeting ID persistence (survives worker restarts)
    if (url.pathname.endsWith("/meeting-id")) {
      if (request.method === "PUT") {
        const body = (await request.json()) as { meetingId: string };
        await this.state.storage.put("meetingId", body.meetingId);
        return Response.json({ ok: true });
      }
      const meetingId =
        await this.state.storage.get<string>("meetingId");
      return Response.json({ meetingId: meetingId ?? null });
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const role = url.searchParams.get("role") || "viewer";
    const lang = url.searchParams.get("lang");

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use Hibernation API — tag hosts so we can identify them in
    // webSocketMessage() without maintaining an in-memory Set.
    const tags = role === "host" ? ["host"] : [];
    this.state.acceptWebSocket(server, tags);

    // Accept initial language from the host's query string
    if (role === "host" && lang) {
      this.language = lang;
    }

    // Connect to Deepgram when first host joins
    if (role === "host" && !this.deepgramWs) {
      this.connectDeepgram().catch((err) => {
        console.error("Failed to connect to Deepgram:", err);
        this.scheduleReconnect();
      });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Hibernation API: called for every message on an accepted WebSocket */
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    // Binary data from hosts = audio chunks → forward to Nova-3
    if (data instanceof ArrayBuffer) {
      const tags = this.state.getTags(ws);
      if (!tags.includes("host")) return;

      this.audioChunkCount++;
      if (this.deepgramWs && this.deepgramWs.readyState === 1) {
        this.deepgramWs.send(data);
        if (this.audioChunkCount % 50 === 1) {
          console.log(`[audio] Forwarded chunk #${this.audioChunkCount} to Deepgram (${data.byteLength} bytes)`);
        }
      } else {
        if (this.audioBuffer.length < MAX_AUDIO_BUFFER) {
          this.audioBuffer.push(data);
        }
        if (this.audioChunkCount % 50 === 1) {
          console.log(`[audio] Buffered chunk #${this.audioChunkCount} (ws=${this.deepgramWs ? `readyState=${this.deepgramWs.readyState}` : "null"}, buffer=${this.audioBuffer.length})`);
        }
      }
      return;
    }

    // Text messages from hosts — currently only "set-language"
    const tags = this.state.getTags(ws);
    if (!tags.includes("host")) return;
    try {
      const msg = JSON.parse(data);
      if (msg.type === "set-language" && typeof msg.language === "string") {
        this.changeLanguage(msg.language);
      }
    } catch {
      // Ignore non-JSON text messages
    }
  }

  /** Hibernation API: called when an accepted WebSocket closes */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const hostCount = this.state.getWebSockets("host").length;
    if (hostCount === 0) {
      this.disconnectDeepgram();
    }
  }

  /** Hibernation API: called on WebSocket error */
  async webSocketError(ws: WebSocket, error: unknown) {
    // Nothing to do — webSocketClose will also fire
  }

  private changeLanguage(lang: string) {
    if (lang === this.language) return;
    const oldLang = this.language;
    this.language = lang;
    console.log(`[lang] Language changed: ${oldLang} → ${lang}`);
    // Cycle the Deepgram connection with the new language.
    // Audio arriving while disconnected is buffered (up to MAX_AUDIO_BUFFER)
    // and flushed when the new connection opens.
    if (this.deepgramWs) {
      this.disconnectDeepgram();
    }
    this.connectDeepgram().catch((err) => {
      console.error("Failed to reconnect Deepgram with new language:", err);
      this.scheduleReconnect();
    });
  }

  /** Chinese languages are unsupported by Nova-3 via Cloudflare AI Gateway */
  private get useDirectDeepgram(): boolean {
    return this.language.startsWith("zh");
  }

  private buildDeepgramParams(): string {
    const params: Record<string, string> = {
      encoding: "linear16",
      sample_rate: "48000",
      language: this.language,
    };
    if (this.useDirectDeepgram) {
      params.model = "nova-2";
    }
    return new URLSearchParams(params).toString();
  }

  private async connectDeepgram() {
    const isDirect = this.useDirectDeepgram;
    const url = isDirect
      ? `https://api.deepgram.com/v1/listen?${this.buildDeepgramParams()}`
      : `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/ai/run/@cf/deepgram/nova-3?${this.buildDeepgramParams()}`;

    const authHeader = isDirect
      ? `Token ${this.env.DEEPGRAM_API_KEY}`
      : `Bearer ${this.env.CF_API_TOKEN}`;

    const redactedUrl = isDirect
      ? url.replace(this.env.DEEPGRAM_API_KEY, "REDACTED")
      : url.replace(this.env.CF_API_TOKEN, "REDACTED");
    console.log(`[deepgram] Connecting: ${redactedUrl}`);

    const resp = await fetch(url, {
      headers: {
        Upgrade: "websocket",
        Authorization: authHeader,
      },
    });

    console.log(`[deepgram] HTTP response status: ${resp.status}`);

    const ws = resp.webSocket;
    if (!ws) {
      const body = await resp.text().catch(() => "(no body)");
      const label = isDirect ? "Deepgram Nova-2" : "Nova-3";
      throw new Error(
        `${label} WebSocket upgrade failed, status: ${resp.status}, body: ${body}`
      );
    }

    ws.accept();
    this.deepgramWs = ws;
    this.reconnectAttempts = 0;

    // Flush any audio chunks buffered while disconnected
    this.flushAudioBuffer();

    ws.addEventListener("message", (event) => {
      this.handleDeepgramMessage(event.data);
    });

    ws.addEventListener("close", (event) => {
      console.log(`[deepgram] WebSocket closed: code=${event.code}, reason=${event.reason || "(none)"}`);
      this.deepgramWs = null;
      this.stopKeepAlive();
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (event) => {
      console.error(`[deepgram] WebSocket error:`, event);
      this.deepgramWs = null;
      this.stopKeepAlive();
      this.scheduleReconnect();
    });

    this.startKeepAlive();
    const model = isDirect ? "Nova-2 (direct)" : "Nova-3 (Cloudflare)";
    console.log(`Connected to Deepgram ${model} (language=${this.language})`);
  }

  private scheduleReconnect() {
    // Don't reconnect if no hosts are connected or already scheduled
    const hostCount = this.state.getWebSockets("host").length;
    if (hostCount === 0 || this.reconnectTimeout) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connectDeepgram().catch((err) => {
        console.error("Deepgram reconnect failed:", err);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (this.deepgramWs && this.deepgramWs.readyState === 1) {
        this.deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 5000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private disconnectDeepgram() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.deepgramWs) {
      try {
        if (this.deepgramWs.readyState === 1) {
          this.deepgramWs.send(JSON.stringify({ type: "CloseStream" }));
          this.deepgramWs.close();
        }
      } catch {
        // Ignore close errors
      }
      this.deepgramWs = null;
    }
    this.stopKeepAlive();
    this.audioBuffer = [];
  }

  private flushAudioBuffer() {
    if (!this.deepgramWs || this.deepgramWs.readyState !== 1) return;
    for (const chunk of this.audioBuffer) {
      this.deepgramWs.send(chunk);
    }
    this.audioBuffer = [];
  }

  /** Handle transcription results from Nova-3 */
  private handleDeepgramMessage(data: string | ArrayBuffer) {
    if (typeof data !== "string") return;

    console.log(`[deepgram] Message received: ${data.slice(0, 500)}`);

    try {
      const result: DeepgramResult = JSON.parse(data);
      if (result.type !== "Results") {
        console.log(`[deepgram] Non-Results message type: ${result.type}`);
        return;
      }

      const transcript = result.channel?.alternatives?.[0]?.transcript;
      if (!transcript) return;

      const caption: CaptionMessage = {
        type: "caption",
        text: transcript,
        isFinal: result.is_final ?? false,
        language: result.channel?.detected_language,
      };

      const msg = JSON.stringify(caption);

      // Broadcast to ALL connected clients
      for (const ws of this.state.getWebSockets()) {
        try {
          ws.send(msg);
        } catch {
          // Socket will be cleaned up by webSocketClose
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }
}
