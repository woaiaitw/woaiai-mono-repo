import { useState, useEffect, useCallback } from "react";

interface CaptionSegment {
  text: string;
  isFinal: boolean;
  language: string;
  speakerUid: number;
  timestamp: number;
}

interface CaptionsProps {
  enabled: boolean;
}

// STT protobuf message structure (simplified — real implementation needs protobuf.js)
interface SttMessage {
  text: string;
  isFinal: boolean;
  language: string;
  uid: number;
}

export function useCaptions() {
  const [segments, setSegments] = useState<CaptionSegment[]>([]);

  const handleSttData = useCallback((data: Uint8Array) => {
    try {
      // For now, try JSON decoding. The real STT protobuf decoding will be added in Phase 3.
      const text = new TextDecoder().decode(data);
      const message = JSON.parse(text) as SttMessage;

      setSegments((prev) => {
        const newSegment: CaptionSegment = {
          text: message.text,
          isFinal: message.isFinal,
          language: message.language,
          speakerUid: message.uid,
          timestamp: Date.now(),
        };

        if (message.isFinal) {
          // Replace any interim segment from this speaker, add the final one
          const withoutInterim = prev.filter(
            (s) => s.speakerUid !== message.uid || s.isFinal
          );
          return [...withoutInterim, newSegment].slice(-20); // Keep last 20 segments
        }

        // Replace interim segment from this speaker
        const withoutOldInterim = prev.filter(
          (s) => s.speakerUid !== message.uid || s.isFinal
        );
        return [...withoutOldInterim, newSegment];
      });
    } catch {
      // Not a caption message
    }
  }, []);

  // Clean up old captions after 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 10000;
      setSegments((prev) => prev.filter((s) => s.timestamp > cutoff));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { segments, handleSttData };
}

export function Captions({ enabled }: CaptionsProps) {
  const { segments } = useCaptions();

  if (!enabled || segments.length === 0) return null;

  const visibleSegments = segments.slice(-3); // Show last 3 lines

  return (
    <div className="absolute bottom-16 left-4 right-4 flex flex-col items-center gap-1 pointer-events-none">
      {visibleSegments.map((segment, i) => (
        <div
          key={`${segment.speakerUid}-${segment.timestamp}-${i}`}
          className={`px-3 py-1 rounded bg-black/75 text-white text-sm max-w-[80%] text-center ${
            segment.isFinal ? "opacity-100" : "opacity-70"
          }`}
        >
          {segment.text}
        </div>
      ))}
    </div>
  );
}
