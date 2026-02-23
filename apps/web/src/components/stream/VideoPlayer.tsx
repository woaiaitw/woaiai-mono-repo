import { useEffect, useRef } from "react";
import type { IRemoteVideoTrack, ICameraVideoTrack } from "agora-rtc-sdk-ng";

interface VideoPlayerProps {
  videoTrack: IRemoteVideoTrack | ICameraVideoTrack | null | undefined;
  label?: string;
  isLocal?: boolean;
  className?: string;
}

export function VideoPlayer({
  videoTrack,
  label,
  isLocal = false,
  className = "",
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      videoTrack.play(containerRef.current, { mirror: isLocal });
      return () => {
        videoTrack.stop();
      };
    }
  }, [videoTrack, isLocal]);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl text-gray-400">
              {label?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        </div>
      )}
      {label && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
          {label}
        </div>
      )}
    </div>
  );
}
