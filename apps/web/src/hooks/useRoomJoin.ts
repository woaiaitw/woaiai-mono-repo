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
    console.log("[RTK-DEBUG] roomState changed:", roomState);
    if (roomState === "init" && !joinCalledRef.current) {
      joinCalledRef.current = true;
      console.log("[RTK-DEBUG] calling meeting.joinRoom()");
      meeting.joinRoom();
    }
    if (roomState === "joined") {
      console.log("[RTK-DEBUG] roomState reached 'joined' — dispatching SDK_JOINED");
      dispatch({ type: "SDK_JOINED" });
    }
  }, [roomState, meeting, dispatch]);

  return roomState;
}
