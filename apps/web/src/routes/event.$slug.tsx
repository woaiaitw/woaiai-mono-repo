import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Stream, SignalingMessage } from "@web-template/shared";
import { authClient } from "~/lib/auth-client";
import {
  getStreamBySlug,
  getViewerToken,
  getHostToken,
  getSpeakerToken,
  getScreenShareToken,
  goLive,
  endStream,
  startRecording,
  stopRecording,
  startStt,
  stopStt,
  getHandRaises,
  raiseHand,
  lowerHand,
} from "~/lib/video-client";
import { useAgora } from "~/hooks/useAgora";
import { createScreenTrack } from "~/lib/agora-client";
import { VideoPlayer } from "~/components/stream/VideoPlayer";
import { HostControls } from "~/components/stream/HostControls";
import { SpeakerPanel } from "~/components/stream/SpeakerPanel";
import { ScreenShareView } from "~/components/stream/ScreenShare";
import { Countdown } from "~/components/stream/Countdown";
import { Captions } from "~/components/stream/Captions";
import { ReplayPlayer } from "~/components/stream/ReplayPlayer";

export const Route = createFileRoute("/event/$slug")({
  component: EventPage,
});

type ViewerRole = "viewer" | "admin" | "host" | "speaker";

function EventPage() {
  const { slug } = Route.useParams();
  const { data: session } = authClient.useSession();

  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<ViewerRole>("viewer");
  const [uid, setUid] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [handRaises, setHandRaises] = useState<
    { uid: number; name: string; userId: string; raisedAt: number }[]
  >([]);
  const [activeSpeakers, setActiveSpeakers] = useState<{ uid: number; name?: string }[]>([]);
  const handRaisePollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const handleSignalingMessage = useCallback(
    (message: SignalingMessage) => {
      switch (message.type) {
        case "stream_status":
          setStream((prev) =>
            prev ? { ...prev, status: message.status } : prev
          );
          break;
        case "promote_speaker":
          if (message.uid === uid) {
            setRole("speaker");
          }
          break;
        case "demote_speaker":
          if (message.uid === uid) {
            setRole("admin");
          }
          break;
        case "transfer_host":
          if (message.uid === uid) {
            setRole("host");
          }
          break;
      }
    },
    [uid]
  );

  const handleTokenRenewal = useCallback(async () => {
    if (!stream) return;
    try {
      if (role === "host") {
        const data = await getHostToken(stream.id);
        await agora.renewToken(data.token);
      } else if (role === "speaker") {
        const data = await getSpeakerToken(stream.id);
        await agora.renewToken(data.token);
      } else {
        const data = await getViewerToken(stream.agoraChannelName);
        await agora.renewToken(data.token);
      }
    } catch (err) {
      console.error("Token renewal failed:", err);
    }
  }, [stream, role]);

  const agora = useAgora({
    onSignalingMessage: handleSignalingMessage,
    onTokenPrivilegeWillExpire: handleTokenRenewal,
  });

  // Load stream data
  useEffect(() => {
    getStreamBySlug(slug)
      .then((data) => {
        setStream(data);
        // Determine role
        if (session?.user) {
          if (data.hostUserId === session.user.id) {
            setRole("host");
          } else {
            setRole("admin"); // Authenticated users are admins
          }
        } else {
          setRole("viewer");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load stream");
        setLoading(false);
      });
  }, [slug, session]);

  // Auto-join when stream is live
  useEffect(() => {
    if (!stream || agora.isJoined) return;
    if (stream.status !== "live" && stream.status !== "paused") return;

    const joinStream = async () => {
      try {
        if (role === "host") {
          const token = await getHostToken(stream.id);
          setUid(token.uid);
          await agora.joinAsHost(token);
          await agora.publishTracks();
        } else {
          const token = await getViewerToken(stream.agoraChannelName);
          setUid(token.uid);
          await agora.joinAsViewer(token);
        }
      } catch (err) {
        console.error("Failed to join stream:", err);
        setError("Failed to join stream. Please refresh the page.");
      }
    };

    joinStream();
  }, [stream?.status, role]);

  // Poll for hand raises (host only)
  useEffect(() => {
    if (role !== "host" || !stream || stream.status !== "live") return;

    const poll = async () => {
      try {
        const raises = await getHandRaises(stream.id);
        setHandRaises(raises);
      } catch {
        // Ignore polling errors
      }
    };

    poll();
    handRaisePollRef.current = setInterval(poll, 3000);
    return () => clearInterval(handRaisePollRef.current);
  }, [role, stream?.id, stream?.status]);

  // Handlers
  const handleGoLive = async () => {
    if (!stream) return;
    try {
      const updated = await goLive(stream.id);
      setStream(updated);

      // Start recording and STT in parallel (non-blocking)
      startRecording(stream.id).catch(console.error);
      startStt(stream.id).catch(console.error);

      // Notify viewers via signaling
      agora.sendSignalingMessage({ type: "stream_status", status: "live" });
    } catch (err) {
      console.error("Failed to go live:", err);
    }
  };

  const handleEndStream = async () => {
    if (!stream) return;
    try {
      agora.sendSignalingMessage({ type: "stream_status", status: "ending" });
      const updated = await endStream(stream.id);
      setStream(updated);

      // Stop recording and STT
      stopRecording(stream.id).catch(console.error);
      stopStt(stream.id).catch(console.error);

      await agora.unpublishTracks();
      await agora.leave();
    } catch (err) {
      console.error("Failed to end stream:", err);
    }
  };

  const handleToggleMute = () => {
    if (agora.localAudioTrack) {
      agora.localAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = () => {
    if (agora.localVideoTrack) {
      agora.localVideoTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!stream) return;

    if (isScreenSharing) {
      // Stop screen sharing is handled by the screen track ending
      setIsScreenSharing(false);
      return;
    }

    try {
      const screenTokenData = await getScreenShareToken(stream.id, uid);
      const screenTrack = await createScreenTrack();

      // Create a separate client for screen sharing
      const { createAgoraClient } = await import("~/lib/agora-client");
      const screenClient = createAgoraClient();
      screenClient.setClientRole("host");
      await screenClient.join(
        screenTokenData.appId,
        screenTokenData.channel,
        screenTokenData.token,
        screenTokenData.uid
      );

      if (Array.isArray(screenTrack)) {
        await screenClient.publish(screenTrack);
      } else {
        await screenClient.publish(screenTrack);
        screenTrack.on("track-ended", async () => {
          await screenClient.unpublish(screenTrack);
          screenTrack.close();
          await screenClient.leave();
          setIsScreenSharing(false);
        });
      }

      setIsScreenSharing(true);
    } catch (err) {
      console.error("Failed to start screen share:", err);
      setIsScreenSharing(false);
    }
  };

  const handlePromoteSpeaker = async (targetUid: number) => {
    agora.sendSignalingMessage({ type: "promote_speaker", uid: targetUid });
    setActiveSpeakers((prev) => [
      ...prev,
      { uid: targetUid, name: handRaises.find((r) => r.uid === targetUid)?.name },
    ]);
    setHandRaises((prev) => prev.filter((r) => r.uid !== targetUid));
  };

  const handleDemoteSpeaker = async (targetUid: number) => {
    agora.sendSignalingMessage({ type: "demote_speaker", uid: targetUid });
    setActiveSpeakers((prev) => prev.filter((s) => s.uid !== targetUid));
  };

  const handleTransferHost = async (targetUid: number) => {
    agora.sendSignalingMessage({ type: "transfer_host", uid: targetUid });
    setRole("speaker");
  };

  const handleHandRaise = async () => {
    if (!stream || !session?.user) return;
    try {
      await raiseHand(stream.id, uid, session.user.name);
    } catch (err) {
      console.error("Failed to raise hand:", err);
    }
  };

  const handleHandLower = async () => {
    if (!stream) return;
    try {
      await lowerHand(stream.id);
    } catch (err) {
      console.error("Failed to lower hand:", err);
    }
  };

  // ─── Render states ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl text-white">Stream Not Found</h1>
          <p className="text-gray-400">{error ?? "This stream does not exist."}</p>
        </div>
      </div>
    );
  }

  // Completed — show replay
  if (stream.status === "completed") {
    return (
      <div className="min-h-screen bg-gray-950 p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{stream.title}</h1>
            {stream.description && (
              <p className="text-gray-400 mt-1">{stream.description}</p>
            )}
            <span className="inline-block mt-2 px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
              Replay
            </span>
          </div>
          <ReplayPlayer streamId={stream.id} title={stream.title} />
        </div>
      </div>
    );
  }

  // Pre-stream — show countdown
  if (
    stream.status === "draft" ||
    stream.status === "scheduled" ||
    stream.status === "pre_stream"
  ) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div>
            <h1 className="text-3xl font-bold text-white">{stream.title}</h1>
            {stream.description && (
              <p className="text-gray-400 mt-2">{stream.description}</p>
            )}
          </div>

          <div className="bg-gray-900 rounded-xl p-8">
            <Countdown
              targetDate={new Date(stream.scheduledAt)}
              onComplete={() =>
                setStream((prev) =>
                  prev ? { ...prev, status: "pre_stream" } : prev
                )
              }
            />
          </div>

          {/* Host controls in pre-stream */}
          {role === "host" && stream.status !== "draft" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                You are the host. Click "Go Live" when ready.
              </p>
              <HostControls
                stream={stream}
                isLive={false}
                isMuted={false}
                isVideoOff={false}
                isScreenSharing={false}
                onGoLive={handleGoLive}
                onEndStream={handleEndStream}
                onToggleMute={() => {}}
                onToggleVideo={() => {}}
                onToggleScreenShare={() => {}}
              />
            </div>
          )}

          {(stream.status as string) === "cancelled" && (
            <p className="text-red-400">This stream has been cancelled.</p>
          )}
        </div>
      </div>
    );
  }

  // Live / Paused — show stream
  const screenShareUser = agora.remoteUsers.find((u) => u.isScreenShare);
  const cameraUsers = agora.remoteUsers.filter((u) => !u.isScreenShare);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-4">
        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{stream.title}</h1>
              {stream.description && (
                <p className="text-sm text-gray-400">{stream.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  stream.status === "live"
                    ? "bg-red-600 text-white"
                    : "bg-yellow-600 text-white"
                }`}
              >
                {stream.status === "live" ? "LIVE" : "PAUSED"}
              </span>
              <button
                type="button"
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={`px-2 py-1 rounded text-xs ${
                  captionsEnabled
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                CC
              </button>
            </div>
          </div>

          {/* Video area */}
          <div className="relative">
            {screenShareUser ? (
              <div className="space-y-2">
                <ScreenShareView videoTrack={screenShareUser.videoTrack ?? null} />
                {/* Camera feeds in PiP strip */}
                <div className="flex gap-2 overflow-x-auto">
                  {/* Local video (host/speaker) */}
                  {(role === "host" || role === "speaker") && (
                    <VideoPlayer
                      videoTrack={agora.localVideoTrack}
                      label="You"
                      isLocal
                      className="w-40 h-28 flex-shrink-0"
                    />
                  )}
                  {cameraUsers.map((user) => (
                    <VideoPlayer
                      key={user.uid}
                      videoTrack={user.videoTrack ?? null}
                      label={`User ${user.uid}`}
                      className="w-40 h-28 flex-shrink-0"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-2" style={{
                gridTemplateColumns: cameraUsers.length > 1
                  ? "repeat(auto-fit, minmax(300px, 1fr))"
                  : "1fr",
              }}>
                {/* Local video (host/speaker) */}
                {(role === "host" || role === "speaker") && (
                  <VideoPlayer
                    videoTrack={agora.localVideoTrack}
                    label="You (Host)"
                    isLocal
                    className="aspect-video"
                  />
                )}
                {cameraUsers.map((user) => (
                  <VideoPlayer
                    key={user.uid}
                    videoTrack={user.videoTrack ?? null}
                    label={`User ${user.uid}`}
                    className="aspect-video"
                  />
                ))}
                {cameraUsers.length === 0 && role === "viewer" && (
                  <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">
                      {stream.status === "paused"
                        ? "Stream is paused — waiting for host..."
                        : "Connecting to stream..."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Captions overlay */}
            <Captions enabled={captionsEnabled} />
          </div>

          {/* Host controls */}
          {role === "host" && (
            <HostControls
              stream={stream}
              isLive={stream.status === "live"}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isScreenSharing={isScreenSharing}
              onGoLive={handleGoLive}
              onEndStream={handleEndStream}
              onToggleMute={handleToggleMute}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
            />
          )}

          {/* Admin hand-raise button */}
          {role === "admin" && stream.status === "live" && (
            <div className="flex justify-center gap-2 p-4">
              <button
                type="button"
                onClick={handleHandRaise}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Raise Hand
              </button>
              <button
                type="button"
                onClick={handleHandLower}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Lower Hand
              </button>
            </div>
          )}
        </div>

        {/* Sidebar (host only — speaker management) */}
        {role === "host" && stream.status === "live" && (
          <div className="lg:w-80">
            <SpeakerPanel
              handRaises={handRaises}
              activeSpeakers={activeSpeakers}
              maxSpeakers={4}
              onPromote={handlePromoteSpeaker}
              onDemote={handleDemoteSpeaker}
              onTransferHost={handleTransferHost}
            />
          </div>
        )}
      </div>
    </div>
  );
}
