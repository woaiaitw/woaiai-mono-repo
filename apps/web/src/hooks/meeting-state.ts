import type { ParticipantRole } from "@web-template/shared";
import type { Participant } from "../components/VideoGrid";

export type MeetingPhase =
  | { status: "idle" }
  | { status: "joining"; role: ParticipantRole }
  | { status: "connecting"; role: ParticipantRole; meetingId: string }
  | { status: "joined"; role: ParticipantRole; meetingId: string }
  | { status: "left" }
  | { status: "error"; message: string };

export interface MeetingState {
  phase: MeetingPhase;
  remoteParticipants: Participant[];
}

export type MeetingAction =
  | { type: "START_JOIN"; role: ParticipantRole }
  | { type: "API_SUCCESS"; meetingId: string }
  | { type: "SDK_JOINED" }
  | { type: "SET_REMOTE_PARTICIPANTS"; participants: Participant[] }
  | { type: "ERROR"; message: string }
  | { type: "LEFT" };

export const initialMeetingState: MeetingState = {
  phase: { status: "idle" },
  remoteParticipants: [],
};

export function meetingReducer(
  state: MeetingState,
  action: MeetingAction
): MeetingState {
  switch (action.type) {
    case "START_JOIN":
      if (state.phase.status !== "idle") return state;
      return { ...state, phase: { status: "joining", role: action.role } };

    case "API_SUCCESS":
      if (state.phase.status !== "joining") return state;
      return {
        ...state,
        phase: {
          status: "connecting",
          role: state.phase.role,
          meetingId: action.meetingId,
        },
      };

    case "SDK_JOINED":
      if (state.phase.status !== "connecting") return state;
      return {
        ...state,
        phase: {
          status: "joined",
          role: state.phase.role,
          meetingId: state.phase.meetingId,
        },
      };

    case "SET_REMOTE_PARTICIPANTS":
      return { ...state, remoteParticipants: action.participants };

    case "ERROR":
      if (state.phase.status === "left") return state;
      return {
        ...state,
        phase: { status: "error", message: action.message },
      };

    case "LEFT":
      return { ...state, phase: { status: "left" }, remoteParticipants: [] };

    default:
      return state;
  }
}
