import { useState, useEffect, useCallback, useRef } from "react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ConnectionState,
} from "agora-rtc-sdk-ng";
import { createAgoraClient, createCameraTracks, isScreenShareUid } from "~/lib/agora-client";
import type { TokenResponse, SignalingMessage } from "@web-template/shared";

interface RemoteUser {
  uid: number;
  audioTrack?: IAgoraRTCRemoteUser["audioTrack"];
  videoTrack?: IAgoraRTCRemoteUser["videoTrack"];
  isScreenShare: boolean;
}

interface UseAgoraOptions {
  onSignalingMessage?: (message: SignalingMessage) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onTokenPrivilegeWillExpire?: () => void;
}

export function useAgora(options: UseAgoraOptions = {}) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("DISCONNECTED");

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createAgoraClient();
    }

    const client = clientRef.current;

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => {
        const existing = prev.find((u) => u.uid === Number(user.uid));
        if (existing) {
          return prev.map((u) =>
            u.uid === Number(user.uid)
              ? {
                  ...u,
                  audioTrack: mediaType === "audio" ? user.audioTrack : u.audioTrack,
                  videoTrack: mediaType === "video" ? user.videoTrack : u.videoTrack,
                }
              : u
          );
        }
        return [
          ...prev,
          {
            uid: Number(user.uid),
            audioTrack: mediaType === "audio" ? user.audioTrack : undefined,
            videoTrack: mediaType === "video" ? user.videoTrack : undefined,
            isScreenShare: isScreenShareUid(Number(user.uid)),
          },
        ];
      });
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      setRemoteUsers((prev) =>
        prev.map((u) =>
          u.uid === Number(user.uid)
            ? {
                ...u,
                audioTrack: mediaType === "audio" ? undefined : u.audioTrack,
                videoTrack: mediaType === "video" ? undefined : u.videoTrack,
              }
            : u
        )
      );
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== Number(user.uid)));
    };

    const handleConnectionStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      options.onConnectionStateChange?.(state);
    };

    const handleStreamMessage = (_uid: number, data: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(data);
        const message = JSON.parse(text) as SignalingMessage;
        options.onSignalingMessage?.(message);
      } catch {
        // Not a signaling message — might be STT protobuf data
      }
    };

    const handleTokenWillExpire = () => {
      options.onTokenPrivilegeWillExpire?.();
    };

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-left", handleUserLeft);
    client.on("connection-state-change", handleConnectionStateChange);
    client.on("stream-message", handleStreamMessage);
    client.on("token-privilege-will-expire", handleTokenWillExpire);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-unpublished", handleUserUnpublished);
      client.off("user-left", handleUserLeft);
      client.off("connection-state-change", handleConnectionStateChange);
      client.off("stream-message", handleStreamMessage);
      client.off("token-privilege-will-expire", handleTokenWillExpire);
    };
  }, []);

  const joinAsViewer = useCallback(async (tokenData: TokenResponse) => {
    const client = clientRef.current!;
    client.setClientRole("audience", { level: 1 });
    await client.join(tokenData.appId, tokenData.channel, tokenData.token, tokenData.uid);
    setIsJoined(true);
  }, []);

  const joinAsHost = useCallback(async (tokenData: TokenResponse) => {
    const client = clientRef.current!;
    client.setClientRole("host");
    await client.join(tokenData.appId, tokenData.channel, tokenData.token, tokenData.uid);
    setIsJoined(true);
  }, []);

  const publishTracks = useCallback(async () => {
    const client = clientRef.current!;
    const [audioTrack, videoTrack] = await createCameraTracks();
    await client.publish([audioTrack, videoTrack]);
    setLocalAudioTrack(audioTrack);
    setLocalVideoTrack(videoTrack);
  }, []);

  const unpublishTracks = useCallback(async () => {
    const client = clientRef.current!;
    if (localAudioTrack) {
      await client.unpublish(localAudioTrack);
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    if (localVideoTrack) {
      await client.unpublish(localVideoTrack);
      localVideoTrack.close();
      setLocalVideoTrack(null);
    }
  }, [localAudioTrack, localVideoTrack]);

  const leave = useCallback(async () => {
    const client = clientRef.current!;
    localAudioTrack?.close();
    localVideoTrack?.close();
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    await client.leave();
    setIsJoined(false);
  }, [localAudioTrack, localVideoTrack]);

  const renewToken = useCallback(async (token: string) => {
    const client = clientRef.current!;
    await client.renewToken(token);
  }, []);

  const sendSignalingMessage = useCallback(async (message: SignalingMessage) => {
    const client = clientRef.current! as IAgoraRTCClient & {
      sendStreamMessage(msg: Uint8Array | string, retry?: boolean): Promise<void>;
    };
    const data = new TextEncoder().encode(JSON.stringify(message));
    await client.sendStreamMessage(data);
  }, []);

  const setClientRole = useCallback(async (role: "host" | "audience") => {
    const client = clientRef.current!;
    if (role === "audience") {
      await client.setClientRole("audience", { level: 1 });
    } else {
      await client.setClientRole("host");
    }
  }, []);

  return {
    client: clientRef.current,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    isJoined,
    connectionState,
    joinAsViewer,
    joinAsHost,
    publishTracks,
    unpublishTracks,
    leave,
    renewToken,
    sendSignalingMessage,
    setClientRole,
  };
}
