import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";

// Reduce SDK log noise in development
AgoraRTC.setLogLevel(3); // WARNING

export type AgoraClient = IAgoraRTCClient;

export function createAgoraClient(): IAgoraRTCClient {
  return AgoraRTC.createClient({ mode: "live", codec: "vp8" });
}

export async function createCameraTracks(): Promise<
  [IMicrophoneAudioTrack, ICameraVideoTrack]
> {
  return AgoraRTC.createMicrophoneAndCameraTracks();
}

export async function createScreenTrack() {
  return AgoraRTC.createScreenVideoTrack({}, "disable");
}

export function isScreenShareUid(uid: number): boolean {
  return uid >= 100000;
}

export {
  AgoraRTC,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
};
