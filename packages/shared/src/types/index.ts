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

export const DEFAULT_LANGUAGE = "multi";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "multi", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "hi", label: "Hindi" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "id", label: "Indonesian" },
  { code: "tr", label: "Turkish" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
];
