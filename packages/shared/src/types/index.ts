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
