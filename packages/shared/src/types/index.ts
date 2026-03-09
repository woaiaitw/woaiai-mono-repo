export type UserRole = "owner" | "admin" | "speaker" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
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

// RTC types
export interface MeetingInfo {
  id: string;
  title: string;
}

export interface JoinResponse {
  authToken: string;
  participantId: string;
  meetingId: string;
}

export interface CaptionMessage {
  type: "caption";
  text: string;
  isFinal: boolean;
  language?: string;
  speakerId?: string;
}

export type ParticipantRole = "host" | "viewer";

// Transcription language support
export interface LanguageOption {
  code: string;
  label: string;
}

export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "Chinese" },
];

// Mux streaming types
export interface MuxStreamInfo {
  id: string;
  streamKey?: string;
  playbackId: string;
  status: "idle" | "active" | "disabled";
  rtmpUrl?: string;
}

export interface MuxStreamListItem {
  id: string;
  playbackId: string;
  status: "idle" | "active" | "disabled";
  createdAt: string;
}

// Stream event types (D1-backed)
export type StreamEventStatus = "scheduled" | "preview" | "live" | "ended";

export interface StreamEvent {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: StreamEventStatus;
  mux_stream_id: string | null;
  mux_playback_id: string | null;
  mux_stream_key: string | null;
  mux_asset_id: string | null;
  created_by: string;
  created_at: string;
  ended_at: string | null;
}

export interface StreamEventHost extends StreamEvent {
  rtmpUrl: string;
}
