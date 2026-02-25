import { useEffect, useRef, type Dispatch } from "react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import type { Participant } from "../components/VideoGrid";
import type { MeetingAction } from "./meeting-state";

export function useParticipants(
  joined: boolean,
  dispatch: Dispatch<MeetingAction>
) {
  const { meeting } = useRealtimeKitMeeting();
  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;

  useEffect(() => {
    if (!joined) {
      dispatch({ type: "SET_REMOTE_PARTICIPANTS", participants: [] });
      return;
    }

    const m = meetingRef.current;

    function subscribeToParticipant(id: string) {
      m.participants
        .subscribe(
          [id],
          ["audio", "video", "screenshareAudio", "screenshareVideo"]
        )
        .catch(() => {});
    }

    function updateParticipants() {
      const remote = Array.from(
        m.participants.joined.values()
      ).map((p: any) => ({
        id: p.id,
        name: p.name,
        videoEnabled: p.videoEnabled,
        audioEnabled: p.audioEnabled,
        videoTrack: p.videoTrack ?? null,
        audioTrack: p.audioTrack ?? null,
        screenShareEnabled: p.screenShareEnabled,
        screenShareTracks: p.screenShareTracks ?? { video: null, audio: null },
        presetName: p.presetName,
      })) as Participant[];
      dispatch({ type: "SET_REMOTE_PARTICIPANTS", participants: remote });
    }

    for (const p of m.participants.joined.values()) {
      subscribeToParticipant(p.id);
    }

    const onParticipantJoined = (participant: any) => {
      subscribeToParticipant(participant.id);
      updateParticipants();
    };

    const trackEvents = [
      "audioUpdate",
      "videoUpdate",
      "screenShareUpdate",
      "participantLeft",
    ] as const;

    // Use a single cast for the event emitter to avoid per-call casts
    const joinedParticipants = m.participants.joined as any;
    for (const event of trackEvents) {
      joinedParticipants.on(event, updateParticipants);
    }
    joinedParticipants.on("participantJoined", onParticipantJoined);

    updateParticipants();
    // Safety-net polling at 10s (reduced from 2s — events handle the fast path)
    const interval = setInterval(updateParticipants, 10000);

    return () => {
      clearInterval(interval);
      for (const event of trackEvents) {
        joinedParticipants.off(event, updateParticipants);
      }
      joinedParticipants.off("participantJoined", onParticipantJoined);
    };
  }, [joined, dispatch]);
}
