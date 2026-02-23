export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

// ─── Stream Types ───────────────────────────────────────────────

export type StreamStatus =
  | "draft"
  | "scheduled"
  | "pre_stream"
  | "live"
  | "paused"
  | "ending"
  | "processing"
  | "completed"
  | "cancelled";

export type ParticipantRole = "host" | "speaker" | "admin" | "viewer";

export type RecordingStatus = "recording" | "processing" | "ready" | "failed";

export type TranscriptFormat = "vtt" | "srt" | "json";

export interface Stream {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: StreamStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  hostUserId: string;
  agoraChannelName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  streamId: string;
  userId: string | null;
  agoraUid: number;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recording {
  id: string;
  streamId: string;
  agoraResourceId: string | null;
  agoraSid: string | null;
  status: RecordingStatus;
  r2Key: string | null;
  fileSize: number | null;
  duration: number | null;
  startedAt: Date | null;
  stoppedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transcript {
  id: string;
  streamId: string;
  language: string;
  format: TranscriptFormat;
  r2Key: string | null;
  isTranslation: boolean;
  sourceTranscriptId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Agora Signaling Message Types ──────────────────────────────

export type SignalingMessage =
  | { type: "stream_status"; status: "live" | "paused" | "ending" }
  | { type: "hand_raise"; uid: number; name: string }
  | { type: "hand_lower"; uid: number }
  | { type: "promote_speaker"; uid: number }
  | { type: "demote_speaker"; uid: number }
  | { type: "transfer_host"; uid: number };

// ─── API Response Types ─────────────────────────────────────────

export interface TokenResponse {
  token: string;
  uid: number;
  appId: string;
  channel: string;
}
