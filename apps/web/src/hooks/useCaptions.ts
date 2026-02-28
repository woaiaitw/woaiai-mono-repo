import { useEffect, useRef, useState } from "react";
import type { CaptionMessage } from "@web-template/shared";
import { getCaptionWsUrl } from "../lib/rtc-client";

export interface CaptionEntry {
  id: number;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export function useCaptions(
  role: string,
  audioTrack: MediaStreamTrack | null
) {
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const captionIdRef = useRef(0);
  const isHost = role === "host";

  // Effect 1: WebSocket connection with auto-reconnect
  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (disposed) return;
      const url = `${getCaptionWsUrl()}?role=${role}`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const msg: CaptionMessage = JSON.parse(event.data);
          if (msg.type !== "caption") return;

          if (msg.isFinal) {
            setInterimText("");
            setCaptions((prev) => [
              ...prev.slice(-4),
              {
                id: captionIdRef.current++,
                text: msg.text,
                isFinal: true,
                timestamp: Date.now(),
              },
            ]);
          } else {
            setInterimText(msg.text);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        // Only null out the ref if it still points to THIS WebSocket.
        // A newer connection may have already replaced it (e.g. React
        // Strict Mode unmount/remount race).
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 1000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [role]);

  // Effect 2: Capture PCM16 from the audioTrack using ScriptProcessorNode.
  // Uses default AudioContext sample rate (48kHz) to avoid resampling
  // artifacts. Server-side Nova-3 is configured for matching sample rate.
  useEffect(() => {
    if (!isHost || !audioTrack) return;

    let stopped = false;
    let ctx: AudioContext | undefined;

    async function start() {
      // Use default sample rate (48kHz) — avoids resampling artifacts
      ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(
        new MediaStream([audioTrack!])
      );
      // 4096 samples at 48kHz ≈ 85ms per chunk, 8192 bytes
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (stopped) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(int16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    }

    start().catch((err) => console.error("[captions] Failed:", err));

    return () => {
      stopped = true;
      if (ctx) ctx.close();
    };
  }, [isHost, audioTrack]);

  // Effect 3: Fade timer — mount once
  useEffect(() => {
    const interval = setInterval(() => {
      setCaptions((prev) =>
        prev.filter((c) => Date.now() - c.timestamp < 8000)
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { captions, interimText };
}
