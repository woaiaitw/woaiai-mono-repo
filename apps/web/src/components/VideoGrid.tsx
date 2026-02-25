import { useCallback, useEffect, useRef, useState } from "react";

export interface Participant {
  id: string;
  name: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenShareEnabled: boolean;
  screenShareTracks: {
    video: MediaStreamTrack | null;
    audio: MediaStreamTrack | null;
  };
  presetName?: string;
}

function VideoTile({
  participant,
  isScreenShare = false,
  isSelf = false,
}: {
  participant: Participant;
  isScreenShare?: boolean;
  isSelf?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const track = isScreenShare
    ? participant.screenShareTracks?.video
    : participant.videoTrack;

  useEffect(() => {
    if (videoRef.current && track) {
      const stream = new MediaStream([track]);
      videoRef.current.srcObject = stream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [track]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {!track && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl text-gray-400">
              {participant.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-sm text-white">
        {participant.name}
        {isSelf && !participant.audioEnabled && " (muted)"}
      </div>
    </div>
  );
}

function AudioPlayer({
  track,
  onAutoplayBlocked,
}: {
  track: MediaStreamTrack | null;
  onAutoplayBlocked?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (track) {
      const stream = new MediaStream([track]);
      el.srcObject = stream;
      el.play().catch(() => {
        onAutoplayBlocked?.();
      });
    } else {
      el.srcObject = null;
    }
  }, [track, onAutoplayBlocked]);

  return <audio ref={audioRef} autoPlay />;
}

/** Resume playback on all <audio> elements inside the container */
function resumeAllAudio(container: HTMLElement) {
  container.querySelectorAll("audio").forEach((el) => {
    if (el.srcObject && el.paused) {
      el.play().catch(() => {});
    }
  });
}

export function VideoGrid({
  participants,
  screenShareParticipant,
  selfId,
}: {
  participants: Participant[];
  screenShareParticipant: Participant | null;
  selfId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const onAutoplayBlocked = useCallback(() => setAutoplayBlocked(true), []);

  const handleUnmute = () => {
    if (containerRef.current) {
      resumeAllAudio(containerRef.current);
    }
    setAutoplayBlocked(false);
  };

  // Show hosts and self — viewers without video are hidden from the grid
  const visibleParticipants = participants.filter(
    (p) =>
      p.presetName === "livestream_host" ||
      p.id === selfId ||
      p.videoEnabled ||
      p.videoTrack
  );

  if (visibleParticipants.length === 0) return null;

  const autoplayBanner = autoplayBlocked && (
    <button
      onClick={handleUnmute}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg shadow-lg hover:bg-blue-500 transition-colors"
    >
      Click to enable audio
    </button>
  );

  // Screen share layout: screen share takes over, hosts shown as thumbnails
  if (screenShareParticipant) {
    return (
      <div ref={containerRef} className="flex-1 flex flex-col gap-2 p-2 relative">
        {autoplayBanner}
        <div className="flex-1 min-h-0">
          <VideoTile participant={screenShareParticipant} isScreenShare />
        </div>
        <div className="flex gap-2 h-32">
          {visibleParticipants.map((p) => (
            <div key={p.id} className="w-48">
              <VideoTile participant={p} isSelf={p.id === selfId} />
              {p.id !== selfId && (
                <AudioPlayer
                  track={p.audioTrack}
                  onAutoplayBlocked={onAutoplayBlocked}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid layout
  const cols =
    visibleParticipants.length <= 1
      ? 1
      : visibleParticipants.length <= 4
        ? 2
        : 3;

  return (
    <div
      ref={containerRef}
      className="flex-1 p-4 grid gap-2 auto-rows-fr relative"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {autoplayBanner}
      {visibleParticipants.map((p) => (
        <div key={p.id}>
          <VideoTile participant={p} isSelf={p.id === selfId} />
          {/* Don't play our own audio back to us */}
          {p.id !== selfId && (
            <AudioPlayer
              track={p.audioTrack}
              onAutoplayBlocked={onAutoplayBlocked}
            />
          )}
        </div>
      ))}
    </div>
  );
}
