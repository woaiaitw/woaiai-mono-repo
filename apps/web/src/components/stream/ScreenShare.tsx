import { useEffect, useRef } from "react";
import type { IRemoteVideoTrack } from "agora-rtc-sdk-ng";

interface ScreenShareViewProps {
  videoTrack: IRemoteVideoTrack | null | undefined;
}

export function ScreenShareView({ videoTrack }: ScreenShareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      videoTrack.play(containerRef.current);
      return () => {
        videoTrack.stop();
      };
    }
  }, [videoTrack]);

  if (!videoTrack) return null;

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden w-full aspect-video">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
        Screen Share
      </div>
    </div>
  );
}
