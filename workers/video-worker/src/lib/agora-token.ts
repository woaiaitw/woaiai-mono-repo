import { RtcTokenBuilder, RtcRole } from "agora-token";

const TOKEN_EXPIRATION_SECONDS = 3600; // 1 hour

export function buildViewerToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number
): string {
  const currentTime = Math.floor(Date.now() / 1000);
  const expireTime = currentTime + TOKEN_EXPIRATION_SECONDS;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.SUBSCRIBER,
    expireTime,
    expireTime
  );
}

export function buildPublisherToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number
): string {
  const currentTime = Math.floor(Date.now() / 1000);
  const expireTime = currentTime + TOKEN_EXPIRATION_SECONDS;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime,
    expireTime
  );
}

export function generateUid(): number {
  return Math.floor(Math.random() * 100000) + 1;
}

export function screenShareUid(cameraUid: number): number {
  return cameraUid + 100000;
}
