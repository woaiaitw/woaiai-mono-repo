import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useReducer, type Dispatch } from "react";
import {
  useRealtimeKitClient,
  RealtimeKitProvider,
} from "@cloudflare/realtimekit-react";
import type { ParticipantRole } from "@web-template/shared";
import { DEFAULT_LANGUAGE } from "@web-template/shared";
import { VideoGrid, type Participant } from "../components/VideoGrid";
import { HostControls } from "../components/HostControls";
import { CaptionOverlay } from "../components/CaptionOverlay";
import { WaitingScreen } from "../components/WaitingScreen";
import {
  meetingReducer,
  initialMeetingState,
  type MeetingAction,
} from "../hooks/meeting-state";
import { useMeetingInit } from "../hooks/useMeetingInit";
import { useRoomJoin } from "../hooks/useRoomJoin";
import { useParticipants } from "../hooks/useParticipants";
import { useSelfParticipant } from "../hooks/useSelfParticipant";
import { useMeetingControls } from "../hooks/useMeetingControls";
import { useBeforeUnload } from "../hooks/useBeforeUnload";
import { useCaptions } from "../hooks/useCaptions";

export const Route = createFileRoute("/meeting")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: (search.role as ParticipantRole) || "viewer",
    lang:
      typeof search.lang === "string" ? search.lang : DEFAULT_LANGUAGE,
  }),
  component: MeetingPage,
});

function MeetingPage() {
  const { role, lang } = Route.useSearch();
  const navigate = useNavigate();
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [state, dispatch] = useReducer(meetingReducer, initialMeetingState);

  useMeetingInit(role, initMeeting, dispatch);
  useBeforeUnload(meeting);

  const { phase } = state;

  if (phase.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{phase.message}</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!meeting || phase.status === "idle" || phase.status === "joining") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">Joining as {role}...</p>
        </div>
      </div>
    );
  }

  const meetingId = "meetingId" in phase ? phase.meetingId : "";
  const activeRole = "role" in phase ? phase.role : role;

  return (
    <RealtimeKitProvider value={meeting}>
      <MeetingRoom
        role={activeRole}
        meetingId={meetingId}
        initialLanguage={lang}
        remoteParticipants={state.remoteParticipants}
        dispatch={dispatch}
      />
    </RealtimeKitProvider>
  );
}

function MeetingRoom({
  role,
  meetingId,
  initialLanguage,
  remoteParticipants,
  dispatch,
}: {
  role: ParticipantRole;
  meetingId: string;
  initialLanguage: string;
  remoteParticipants: Participant[];
  dispatch: Dispatch<MeetingAction>;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const navigate = useNavigate();
  const roomState = useRoomJoin(dispatch);
  const joined = roomState === "joined";
  const isHost = role === "host";

  useParticipants(joined, dispatch);
  const selfParticipant = useSelfParticipant(isHost, joined);
  const controls = useMeetingControls(() => {
    dispatch({ type: "LEFT" });
    navigate({ to: "/" });
  });

  const { captions, interimText } = useCaptions(
    role,
    isHost && joined ? (selfParticipant?.audioTrack ?? null) : null,
    language
  );

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="inline-block w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const participantArray: Participant[] = selfParticipant
    ? [selfParticipant, ...remoteParticipants]
    : remoteParticipants;

  const displayParticipants = isHost
    ? participantArray
    : participantArray.filter((p) => p.id !== selfParticipant?.id);

  const screenShareParticipant =
    displayParticipants.find((p) => p.screenShareEnabled) ?? null;

  const hasHosts =
    isHost ||
    remoteParticipants.some(
      (p) =>
        p.presetName === "group_call_host" || p.videoEnabled || p.videoTrack
    );

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 relative">
      <div className="bg-gray-800 text-gray-400 text-xs font-mono px-3 py-1 flex gap-4">
        <span>Meeting: {meetingId}</span>
        <span>Role: {role}</span>
        <span>Participants: {participantArray.length}</span>
      </div>

      {!hasHosts && !isHost ? (
        <WaitingScreen />
      ) : (
        <VideoGrid
          participants={displayParticipants}
          screenShareParticipant={screenShareParticipant}
          selfId={selfParticipant?.id}
        />
      )}

      <CaptionOverlay captions={captions} interimText={interimText} />

      {isHost ? (
        <HostControls
          audioEnabled={selfParticipant?.audioEnabled ?? false}
          videoEnabled={selfParticipant?.videoEnabled ?? false}
          screenShareEnabled={selfParticipant?.screenShareEnabled ?? false}
          language={language}
          onToggleAudio={controls.toggleAudio}
          onToggleVideo={controls.toggleVideo}
          onToggleScreenShare={controls.toggleScreenShare}
          onLanguageChange={setLanguage}
          onLeave={controls.leave}
        />
      ) : (
        <div className="flex justify-center p-4 bg-gray-900/80 backdrop-blur">
          <button
            onClick={controls.leave}
            className="px-6 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
