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
      console.log("[RTK-DEBUG] subscribing to participant:", id);
      m.participants
        .subscribe(
          [id],
          ["audio", "video", "screenshareAudio", "screenshareVideo"]
        )
        .then(() => console.log("[RTK-DEBUG] subscribe SUCCESS for:", id))
        .catch((err: unknown) =>
          console.error("[RTK-DEBUG] subscribe FAILED for:", id, err)
        );
    }

    function updateParticipants() {
      const raw = Array.from(m.participants.joined.values());
      console.log(
        "[RTK-DEBUG] updateParticipants — raw joined:",
        raw.map((p: any) => ({
          id: p.id,
          name: p.name,
          presetName: p.presetName,
          preset: p.preset,
          videoEnabled: p.videoEnabled,
          audioEnabled: p.audioEnabled,
          hasVideoTrack: !!p.videoTrack,
          hasAudioTrack: !!p.audioTrack,
          videoTrackReadyState: p.videoTrack?.readyState ?? "N/A",
          audioTrackReadyState: p.audioTrack?.readyState ?? "N/A",
          allKeys: Object.keys(p),
        }))
      );
      const remote = raw.map((p: any) => ({
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

    // Enable manual subscription mode before subscribing to any participants.
    // Without this, participants.subscribe() fails with ERR1206.
    console.log("[RTK-DEBUG] setting viewMode to MANUAL");
    (m.participants as any)
      .setViewMode("MANUAL")
      .then(() => {
        console.log("[RTK-DEBUG] viewMode set to MANUAL successfully");

        // Now subscribe to any participants already in the meeting
        const initialJoined = Array.from(m.participants.joined.values());
        console.log(
          "[RTK-DEBUG] initial joined participants:",
          initialJoined.length,
          initialJoined.map((p: any) => p.id)
        );
        for (const p of initialJoined) {
          subscribeToParticipant(p.id);
        }
        updateParticipants();
      })
      .catch((err: unknown) => {
        console.error("[RTK-DEBUG] setViewMode FAILED:", err);
      });

    const onParticipantJoined = (participant: any) => {
      console.log("[RTK-DEBUG] participantJoined event:", {
        id: participant.id,
        name: participant.name,
        presetName: participant.presetName,
        preset: participant.preset,
      });
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
