import { useEffect, useRef, type Dispatch } from "react";
import type { ParticipantRole } from "@web-template/shared";
import { joinMeeting } from "../lib/rtc-client";
import type { MeetingAction } from "./meeting-state";

export function useMeetingInit(
  role: ParticipantRole,
  initMeeting: (config: {
    authToken: string;
    defaults: { audio: boolean; video: boolean };
  }) => void,
  dispatch: Dispatch<MeetingAction>
) {
  const initMeetingRef = useRef(initMeeting);
  initMeetingRef.current = initMeeting;

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "START_JOIN", role });

    joinMeeting(role, undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        dispatch({ type: "API_SUCCESS", meetingId: result.meetingId });
        initMeetingRef.current({
          authToken: result.authToken,
          defaults: {
            audio: role === "host",
            video: role === "host",
          },
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "ERROR",
          message: err instanceof Error ? err.message : "Failed to join",
        });
      });

    return () => controller.abort();
  }, [role, dispatch]);
}
