import { useMemo } from "react";
import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import type { Participant } from "../components/VideoGrid";

export function useSelfParticipant(
  isHost: boolean,
  joined: boolean
): Participant | null {
  const selfId = useRealtimeKitSelector((m) => m.self.id) as string;
  const selfName = useRealtimeKitSelector((m) => m.self.name) as string;
  const selfAudioEnabled = useRealtimeKitSelector((m) => m.self.audioEnabled);
  const selfVideoEnabled = useRealtimeKitSelector((m) => m.self.videoEnabled);
  const selfScreenShareEnabled = useRealtimeKitSelector(
    (m) => m.self.screenShareEnabled
  );
  const selfVideoTrack = useRealtimeKitSelector(
    (m) => m.self.videoTrack
  ) as MediaStreamTrack | null;
  const selfAudioTrack = useRealtimeKitSelector(
    (m) => m.self.audioTrack
  ) as MediaStreamTrack | null;
  const selfScreenShareTracks = useRealtimeKitSelector(
    (m) => m.self.screenShareTracks
  ) as
    | { video: MediaStreamTrack | null; audio: MediaStreamTrack | null }
    | undefined;

  return useMemo(() => {
    if (!joined) return null;
    return {
      id: selfId,
      name: selfName || (isHost ? "You" : "Viewer"),
      videoEnabled: selfVideoEnabled,
      audioEnabled: selfAudioEnabled,
      videoTrack: selfVideoTrack,
      audioTrack: selfAudioTrack,
      screenShareEnabled: selfScreenShareEnabled,
      screenShareTracks: selfScreenShareTracks ?? { video: null, audio: null },
      presetName: isHost ? "livestream_host" : "livestream_viewer",
    };
  }, [
    isHost,
    joined,
    selfId,
    selfName,
    selfVideoEnabled,
    selfAudioEnabled,
    selfVideoTrack,
    selfAudioTrack,
    selfScreenShareEnabled,
    selfScreenShareTracks,
  ]);
}
