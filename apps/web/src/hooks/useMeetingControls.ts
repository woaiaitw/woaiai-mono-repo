import { useMemo, useRef } from "react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";

export interface MeetingControls {
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  leave: () => void;
}

export function useMeetingControls(onLeave: () => void): MeetingControls {
  const { meeting } = useRealtimeKitMeeting();
  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  return useMemo(
    () => ({
      toggleAudio: () => {
        const m = meetingRef.current;
        if (m.self.audioEnabled) m.self.disableAudio();
        else m.self.enableAudio();
      },
      toggleVideo: () => {
        const m = meetingRef.current;
        if (m.self.videoEnabled) m.self.disableVideo();
        else m.self.enableVideo();
      },
      toggleScreenShare: () => {
        const m = meetingRef.current;
        if (m.self.screenShareEnabled) m.self.disableScreenShare();
        else m.self.enableScreenShare();
      },
      leave: () => {
        meetingRef.current.leave();
        onLeaveRef.current();
      },
    }),
    []
  );
}
