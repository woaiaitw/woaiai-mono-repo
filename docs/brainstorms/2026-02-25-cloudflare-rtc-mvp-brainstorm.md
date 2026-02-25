# Cloudflare Realtime MVP - Brainstorm

**Date:** 2026-02-25
**Status:** Draft

## What We're Building

A real-time broadcast MVP using Cloudflare RealtimeKit where:

- **Home page** has two buttons: "Start as Host" and "Join as Viewer" (anonymous, no login)
- **Hosts** broadcast webcam + audio. When a host shares their screen, it takes over the video feed (one screen share at a time)
- **Viewers** watch all host feeds with no publish permissions
- **Live transcription** via Deepgram overlaid as subtitles on the video, supporting English and Chinese simultaneously

## Why This Approach

**RealtimeKit with Custom UI** was chosen over:

- **Low-level SFU**: Too much boilerplate for an MVP. RealtimeKit handles WebRTC complexity, session management, and participant lifecycle.
- **RealtimeKit pre-built `<RtkMeeting />`**: Doesn't give enough control for screen-share-takes-over behavior or caption overlay positioning.

Using RealtimeKit's React SDK hooks gives us the meeting infrastructure while allowing custom layout for the host/viewer distinction, screen share takeover, and Deepgram caption overlay.

## Key Decisions

1. **SDK**: RealtimeKit React SDK (`@cloudflare/realtimekit-react`) with custom UI — not the pre-built `<RtkMeeting />` component
2. **Roles**: RealtimeKit "presets" to distinguish hosts (can publish audio/video/screen) from viewers (subscribe-only)
3. **Auth**: Anonymous — no login required. Just click Host or Viewer on the home page
4. **Screen share**: When a host shares their screen, it becomes the main/dominant video. Only one screen share active at a time
5. **Transcription**: Deepgram real-time streaming API via WebSocket, supporting English + Chinese simultaneously
6. **Captions**: Overlaid directly on the video feed as live subtitles (not a side panel)
7. **Backend**: New Cloudflare Worker (`rtc-worker`) to handle RealtimeKit API calls (create meetings, add participants, manage presets)

## Architecture

```
Home Page (/)
  |
  +-- [Start as Host] --> creates/joins meeting as host preset
  |                       publishes webcam + audio
  |                       can share screen (takes over feed)
  |                       audio sent to Deepgram for transcription
  |
  +-- [Join as Viewer] --> joins meeting as viewer preset
                           subscribes to all host tracks
                           sees live captions overlaid on video

Backend (rtc-worker on Cloudflare Workers):
  - POST /api/rtc/meeting          --> create meeting via RealtimeKit API
  - POST /api/rtc/meeting/join     --> add participant with host/viewer preset
  - Stores REALTIME_APP_ID + REALTIME_APP_SECRET

Deepgram Integration:
  - Host captures audio MediaStream
  - Opens WebSocket to Deepgram with `model: "nova-2", language: "multi"`
  - Host sends transcription text to rtc-worker via WebSocket
  - Worker broadcasts captions to all connected viewers
  - Viewers render captions as overlay on video

Meeting Lifecycle:
  - Viewer joins before host --> "Waiting for host..." screen
  - Host joins --> meeting starts, viewers see host feeds
  - Single room (no room codes for MVP)
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + TanStack Start (existing) |
| RTC SDK | `@cloudflare/realtimekit-react` |
| RTC Backend | New Cloudflare Worker (`rtc-worker`) |
| Transcription | Deepgram real-time WebSocket API |
| Styling | Tailwind CSS v4 (existing) |

## Scope — What's IN the MVP

- Home page with Host / Viewer buttons
- Host: webcam + audio publishing
- Host: screen share that takes over the main video
- Viewer: watch all host streams
- Live Deepgram transcription with English + Chinese
- Overlaid subtitle captions on video
- Single "room" (all hosts and viewers in one meeting)

## Scope — What's NOT in the MVP

- Authentication / user accounts
- Multiple rooms / room codes
- Chat
- Recording
- Host controls (mute viewers, kick, etc.)
- Mobile optimization
- Persistent transcription history

## Resolved Questions

1. **Deepgram language config**: Use Deepgram's `multi` model for auto-detection. Speakers can freely switch between English and Chinese mid-conversation.
2. **Caption broadcast mechanism**: Host sends transcription results to the rtc-worker, which broadcasts to all viewers via WebSocket. Single Deepgram connection per host, not per viewer.
3. **Meeting lifecycle**: Show a "Waiting for host..." screen when viewers join before any host is broadcasting.

## Open Questions

None — ready for planning.
