/**
 * STT Data Stream Message Decoder
 *
 * Agora Real-Time STT sends transcription results as protobuf-encoded
 * data stream messages. This module decodes them into usable caption data.
 *
 * The protobuf schema follows Agora's STT data format:
 * https://docs.agora.io/en/real-time-stt/develop/parse-data
 *
 * For the MVP, we use a simplified JSON-based approach since the STT
 * data stream can also be configured to send JSON. The protobuf decoding
 * can be added later if needed for performance.
 */

export interface SttSegment {
  /** Transcribed text */
  text: string;
  /** Whether this is a final result (vs interim) */
  isFinal: boolean;
  /** Detected language (e.g., "en-US", "zh-CN") */
  language: string;
  /** Speaker's Agora UID */
  speakerUid: number;
  /** Start time in milliseconds */
  startMs: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Decode STT data from a data stream message.
 * Attempts JSON first, falls back to protobuf structure.
 */
export function decodeSttMessage(data: Uint8Array): SttSegment | null {
  try {
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);

    // Check if this is an STT message (has expected fields)
    if (parsed.text !== undefined && parsed.uid !== undefined) {
      return {
        text: parsed.text ?? "",
        isFinal: parsed.isFinal ?? parsed.is_final ?? false,
        language: parsed.language ?? parsed.lang ?? "en-US",
        speakerUid: parsed.uid ?? 0,
        startMs: parsed.startMs ?? parsed.start_ms ?? 0,
        durationMs: parsed.durationMs ?? parsed.duration_ms ?? 0,
      };
    }

    // Agora STT protobuf format (simplified parsing)
    // The actual protobuf has these fields:
    // - vendor (int32)
    // - version (int32)
    // - seqnum (int32)
    // - uid (int32)
    // - flag (int32)
    // - time (int64)
    // - lang (int32)
    // - starttime (int32)
    // - offtime (int32)
    // - words[] { text, startMs, durationMs, isFinal, confidence }
    if (parsed.words && Array.isArray(parsed.words)) {
      const words = parsed.words as {
        text: string;
        isFinal?: boolean;
        startMs?: number;
        durationMs?: number;
      }[];
      const fullText = words.map((w) => w.text).join("");
      const lastWord = words[words.length - 1];

      return {
        text: fullText,
        isFinal: lastWord?.isFinal ?? false,
        language: languageCodeToString(parsed.lang ?? 0),
        speakerUid: parsed.uid ?? 0,
        startMs: parsed.starttime ?? 0,
        durationMs: parsed.offtime ?? 0,
      };
    }

    return null;
  } catch {
    // Binary protobuf — would need protobufjs for full decoding
    // For now, skip binary messages
    return null;
  }
}

function languageCodeToString(code: number): string {
  const languages: Record<number, string> = {
    0: "en-US",
    1: "zh-CN",
    2: "ja-JP",
    3: "ko-KR",
  };
  return languages[code] ?? "en-US";
}

/**
 * Convert accumulated STT segments to VTT format for transcript storage.
 */
export function segmentsToVtt(segments: SttSegment[]): string {
  const lines: string[] = ["WEBVTT", ""];

  segments.forEach((segment, index) => {
    const start = formatVttTime(segment.startMs);
    const end = formatVttTime(segment.startMs + segment.durationMs);
    lines.push(`${index + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
  });

  return lines.join("\n");
}

function formatVttTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}
