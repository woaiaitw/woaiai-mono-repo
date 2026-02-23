interface TranscriptSegment {
  text: string;
  startMs: number;
  durationMs: number;
  language: string;
  speakerUid: number;
}

/**
 * Convert accumulated transcript segments to VTT format.
 */
export function generateVtt(segments: TranscriptSegment[]): string {
  const lines: string[] = ["WEBVTT", ""];

  segments.forEach((segment, index) => {
    const start = formatTime(segment.startMs);
    const end = formatTime(segment.startMs + segment.durationMs);
    lines.push(`${index + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Convert accumulated transcript segments to SRT format.
 */
export function generateSrt(segments: TranscriptSegment[]): string {
  const lines: string[] = [];

  segments.forEach((segment, index) => {
    const start = formatSrtTime(segment.startMs);
    const end = formatSrtTime(segment.startMs + segment.durationMs);
    lines.push(`${index + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
  });

  return lines.join("\n");
}

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ml = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ml, 3)}`;
}

function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ml = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ml, 3)}`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}
