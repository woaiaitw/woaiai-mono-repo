import { useEffect, useRef, type Dispatch } from "react";
import {
  useRealtimeKitMeeting,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import type { MeetingAction } from "./meeting-state";

export function useRoomJoin(dispatch: Dispatch<MeetingAction>) {
  const { meeting } = useRealtimeKitMeeting();
  const roomState = useRealtimeKitSelector((m) => m.self.roomState);
  const joinCalledRef = useRef(false);

  useEffect(() => {
    if (roomState === "init" && !joinCalledRef.current) {
      joinCalledRef.current = true;
      meeting.joinRoom();
    }
    if (roomState === "joined") {
      dispatch({ type: "SDK_JOINED" });
    }
  }, [roomState, meeting, dispatch]);

  return roomState;
}
