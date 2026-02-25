---
title: "feat: Cloudflare Realtime broadcast MVP with live transcription"
type: feat
status: completed
date: 2026-02-25
origin: docs/brainstorms/2026-02-25-cloudflare-rtc-mvp-brainstorm.md
---

# feat: Cloudflare Realtime broadcast MVP with live transcription

## Overview

Build an MVP real-time broadcast app using Cloudflare RealtimeKit where hosts stream webcam + audio (with screen share) to viewers, with live Deepgram transcription overlaid as subtitles. Anonymous access — home page has "Start as Host" and "Join as Viewer" buttons. Single room, no auth required.

(see brainstorm: `docs/brainstorms/2026-02-25-cloudflare-rtc-mvp-brainstorm.md`)

## Problem Statement / Motivation

We need to evaluate Cloudflare's real-time communications platform for our use case: multi-host broadcasting with live bilingual transcription. This MVP validates the technology stack before investing in a production implementation.

## Proposed Solution

Use **Cloudflare RealtimeKit React SDK** (`@cloudflare/realtimekit-react` v1.2.4) with custom UI (not pre-built `<RtkMeeting />` component) for full layout control. A new **rtc-worker** (Hono on Cloudflare Workers) handles the server-side RealtimeKit API and broadcasts Deepgram captions to viewers via WebSocket. Deepgram provides real-time transcription with language detection for English and Chinese.

### Critical Finding: Deepgram Multilingual Limitation

Deepgram's `language=multi` code-switching mode does **NOT** support Chinese. The brainstorm assumed auto-detect would work for English + Chinese — this needs adjustment.

**Recommended approach for MVP:** Use `detect_language=true` with Nova-2 model. This auto-detects the dominant language per utterance (not mid-sentence). For conversations where speakers alternate between English and Chinese between sentences, this works well. Mid-sentence code-switching (e.g., "let's go to the ") will default to the dominant language of that segment.

**Future option:** Dual-stream approach (two parallel Deepgram connections, one `language=en` and one `language=zh`, merging by confidence) for better code-switching. Out of scope for MVP.

## Technical Considerations

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Home Page (/)                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  Start as Host   │  │    Join as Viewer         │  │
│  └────────┬─────────┘  └────────────┬─────────────┘  │
│           │                         │                 │
│           ▼                         ▼                 │
│  ┌──────────────────────────────────────────────────┐│
│  │              Meeting Room (/meeting)              ││
│  │  ┌─────────────────────────────────────────────┐ ││
│  │  │  Video Grid (hosts) / Screen Share Takeover │ ││
│  │  │  ┌───────────────────────────────────────┐  │ ││
│  │  │  │         Subtitle Overlay              │  │ ││
│  │  │  └───────────────────────────────────────┘  │ ││
│  │  └─────────────────────────────────────────────┘ ││
│  │  Host controls: mic | camera | screen share       ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘

Backend:
┌─────────────────────────────────────────────────┐
│            rtc-worker (:8787)                     │
│  Hono routes:                                    │
│  POST /api/rtc/meeting      → create meeting     │
│  POST /api/rtc/join         → add participant     │
│  POST /api/rtc/token        → Deepgram temp token │
│  GET  /api/rtc/ws           → caption broadcast   │
│                                                   │
│  Proxies to:                                     │
│  - Cloudflare RealtimeKit API (meeting mgmt)     │
│  - Deepgram Token API (temp token generation)    │
└─────────────────────────────────────────────────┘
```

### RealtimeKit Integration

- **Presets**: Create two presets via RealtimeKit API during app setup:
  - `host`: `audio.can_produce: ALLOWED`, `video.can_produce: ALLOWED`, `screenshare.can_produce: ALLOWED`
  - `viewer`: All `can_produce: NOT_ALLOWED` (subscribe-only)
- **Auth tokens**: Server creates meeting + adds participant → gets JWT `authToken` → client passes to `initMeeting()`
- **Screen share**: `meeting.self.enableScreenShare()` / `disableScreenShare()`. Detect via `participant.screenShareEnabled` and `participant.screenShareTracks.video`
- **Audio access**: `meeting.self.audioTrack` returns `MediaStreamTrack` for Deepgram input

### Deepgram Integration

- Host's browser captures audio from `meeting.self.audioTrack` (or `getUserMedia` stream)
- Connects to Deepgram via WebSocket using a temporary token (30s TTL) from rtc-worker
- Deepgram params: `model=nova-2&detect_language=true&interim_results=true&smart_format=true&punctuate=true&endpointing=300`
- Host sends transcript results to rtc-worker WebSocket
- rtc-worker broadcasts to all connected viewer WebSockets
- Viewers render captions as overlay

### Caption Broadcast via Durable Object

The rtc-worker needs persistent WebSocket connections for caption broadcasting. Use a **Durable Object** (simplest approach for Cloudflare Workers WebSocket management):

- `CaptionRoom` Durable Object manages WebSocket connections for the single room
- Host sends `{ type: "caption", text: "...", isFinal: boolean, language: "en"|"zh" }`
- Durable Object broadcasts to all connected viewer WebSockets
- Viewers connect via `new WebSocket("wss://rtc-worker.../api/rtc/ws")`

## Acceptance Criteria

- [x] Home page shows "Start as Host" and "Join as Viewer" buttons
- [x] Clicking "Start as Host" requests camera/mic permissions, then joins meeting as host
- [x] Clicking "Join as Viewer" joins meeting as viewer (no camera/mic prompt)
- [x] Host's webcam + audio visible/audible to all viewers
- [x] Multiple hosts supported — all visible in a grid layout
- [x] Host can start screen share — it becomes the dominant/main video for all participants
- [x] Host can stop screen share — returns to webcam grid
- [x] Only one screen share at a time (first host to share wins)
- [x] Viewer joining before any host sees "Waiting for host..." screen
- [x] Live Deepgram transcription appears as overlaid subtitles
- [x] Transcription handles both English and Chinese (per-utterance detection)
- [x] Caption text broadcasts from host to all viewers via WebSocket
- [x] Graceful handling when browser denies camera/mic permissions (show error, suggest viewer mode)
- [x] Host controls visible: toggle mic, toggle camera, toggle screen share, leave

## Implementation Phases

### Phase 1: rtc-worker scaffold + RealtimeKit API integration

Create the new worker following auth-worker patterns. Wire up RealtimeKit meeting creation and participant management.

**Files to create:**

| File | Purpose |
|------|---------|
| `workers/rtc-worker/package.json` | Worker package (hono, wrangler deps) |
| `workers/rtc-worker/wrangler.toml` | Wrangler config (port 8787, vars, DO binding) |
| `workers/rtc-worker/tsconfig.json` | Extends root tsconfig |
| `workers/rtc-worker/src/env.d.ts` | `Env` interface (secrets, bindings) |
| `workers/rtc-worker/src/index.ts` | Hono app with CORS + routes |
| `workers/rtc-worker/src/lib/realtimekit.ts` | RealtimeKit API client (create meeting, add participant) |
| `workers/rtc-worker/src/lib/caption-room.ts` | Durable Object for WebSocket caption broadcast |

**`workers/rtc-worker/src/env.d.ts`:**
```typescript
export interface Env {
  // Cloudflare RealtimeKit credentials
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  REALTIME_APP_ID: string;
  // Deepgram
  DEEPGRAM_API_KEY: string;
  // CORS
  WEB_URL: string;
  // Durable Object binding
  CAPTION_ROOM: DurableObjectNamespace;
}
```

**`workers/rtc-worker/wrangler.toml`:**
```toml
name = "rtc-worker"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[dev]
port = 8787

[vars]
WEB_URL = "http://localhost:3000"

[durable_objects]
bindings = [
  { name = "CAPTION_ROOM", class_name = "CaptionRoom" }
]

[[migrations]]
tag = "v1"
new_classes = ["CaptionRoom"]
```

**API routes:**

| Method | Path | Action |
|--------|------|--------|
| `POST` | `/api/rtc/meeting` | Create meeting via RealtimeKit API, return `meetingId` |
| `POST` | `/api/rtc/join` | Add participant (body: `{ role: "host"|"viewer", name?: string }`), return `authToken` |
| `POST` | `/api/rtc/deepgram-token` | Generate Deepgram temporary token (30s TTL) |
| `GET` | `/api/rtc/ws` | Upgrade to WebSocket → route to `CaptionRoom` Durable Object |
| `GET` | `/health` | Health check |

### Phase 2: Frontend — home page + meeting room route

Replace home page content with Host/Viewer buttons. Create new `/meeting` route with RealtimeKit integration.

**Files to create:**

| File | Purpose |
|------|---------|
| `apps/web/src/routes/meeting.tsx` | Meeting room page (RealtimeKit + custom UI) |
| `apps/web/src/lib/rtc-client.ts` | API client for rtc-worker |
| `apps/web/src/components/VideoGrid.tsx` | Participant video grid component |
| `apps/web/src/components/HostControls.tsx` | Mic/camera/screenshare toggle bar |
| `apps/web/src/components/CaptionOverlay.tsx` | Subtitle overlay component |
| `apps/web/src/components/WaitingScreen.tsx` | "Waiting for host..." display |

**Files to modify:**

| File | Change |
|------|--------|
| `apps/web/src/routes/index.tsx` | Replace content with Host/Viewer buttons that navigate to `/meeting?role=host` or `/meeting?role=viewer` |
| `apps/web/wrangler.jsonc` | Add `"RTC_WORKER_URL": "http://localhost:8787"` to vars |
| `apps/web/package.json` | Add `@cloudflare/realtimekit-react` dependency |

**Meeting room flow (`apps/web/src/routes/meeting.tsx`):**

```
1. Read `role` from URL search params (?role=host or ?role=viewer)
2. Call rtc-worker POST /api/rtc/meeting (create or get existing meeting)
3. Call rtc-worker POST /api/rtc/join with role → get authToken
4. Initialize RealtimeKit: initMeeting({ authToken, defaults: { audio: role === 'host', video: role === 'host' } })
5. Wrap in <RealtimeKitProvider>
6. Render custom UI:
   - If no hosts joined yet → <WaitingScreen />
   - If screen share active → full-screen share video + small host webcam thumbnails
   - Otherwise → <VideoGrid /> with all host webcam feeds
   - <CaptionOverlay /> always visible at bottom
   - If role === host → <HostControls />
```

**VideoGrid component:**
- Uses `useRealtimeKitSelector((m) => m.participants.joined)` to get participant list
- Filters to show only host participants (by `presetName`)
- Renders `<video>` elements with `participant.videoTrack` attached
- Detects `participant.screenShareEnabled` → switches to screen share layout

**CaptionOverlay component:**
- Connects to rtc-worker WebSocket at `/api/rtc/ws`
- Receives `{ type: "caption", text, isFinal, language }` messages
- Renders current interim text + recent final texts as overlaid subtitles
- Fades out old captions after ~5 seconds

### Phase 3: Deepgram transcription integration

Wire up host's audio to Deepgram for live transcription, broadcast results to viewers.

**Files to create:**

| File | Purpose |
|------|---------|
| `apps/web/src/lib/deepgram.ts` | Deepgram WebSocket connection manager |

**Files to modify:**

| File | Change |
|------|--------|
| `apps/web/src/routes/meeting.tsx` | Start Deepgram when host joins, stop on leave |
| `apps/web/src/components/CaptionOverlay.tsx` | Handle both host-local and viewer-remote captions |

**Deepgram flow (host only):**

```
1. After RealtimeKit meeting join completes:
2. Fetch temp token: POST /api/rtc/deepgram-token → { token }
3. Open WebSocket: wss://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&...
   Auth: Sec-WebSocket-Protocol: ['token', tempToken]
4. Capture audio: meeting.self.audioTrack → MediaStream → MediaRecorder
5. MediaRecorder.ondataavailable → send chunks to Deepgram WebSocket
6. Deepgram returns transcription results
7. On each result: send { type: "caption", text, isFinal, language } to rtc-worker WebSocket
8. rtc-worker Durable Object broadcasts to all viewer WebSockets
9. KeepAlive interval every 10s
10. On leave: send CloseStream, close WebSocket, stop MediaRecorder
```

**Caption data flow:**

```
Host's mic → MediaRecorder → Deepgram WebSocket → transcript JSON
  → Host sends to rtc-worker WS → Durable Object → broadcast to Viewer WS
  → CaptionOverlay renders subtitle
```

### Phase 4: Polish and edge cases

- Camera/mic permission denial: show error message with "Join as Viewer instead" option
- Screen share conflict: if a host tries to share while another is sharing, show toast "Another host is already sharing"
- Reconnection: RealtimeKit handles WebRTC reconnection internally; add reconnection logic for Deepgram WebSocket and caption WebSocket
- Host leave: if last host leaves, viewers see "Waiting for host..." again
- Responsive layout: basic desktop layout (not mobile-optimized per brainstorm scope)

## Shared Package Updates

**Files to modify:**

| File | Change |
|------|--------|
| `packages/shared/src/types/index.ts` | Add RTC types |
| `packages/shared/src/utils/index.ts` | Add `getRtcUrl()` helper |

**New types:**
```typescript
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
```

## Environment Variables & Secrets

| Variable | Location | Type | Notes |
|----------|----------|------|-------|
| `CF_ACCOUNT_ID` | rtc-worker `.dev.vars` | Secret | Cloudflare account ID |
| `CF_API_TOKEN` | rtc-worker `.dev.vars` | Secret | API token with Realtime Admin perms |
| `REALTIME_APP_ID` | rtc-worker `.dev.vars` | Secret | From RealtimeKit dashboard |
| `DEEPGRAM_API_KEY` | rtc-worker `.dev.vars` | Secret | Deepgram API key |
| `WEB_URL` | rtc-worker `wrangler.toml` vars | Var | `http://localhost:3000` |
| `RTC_WORKER_URL` | web `wrangler.jsonc` vars | Var | `http://localhost:8787` |
| `VITE_RTC_WORKER_URL` | web `.env` or Vite config | Var | Client-side worker URL |

## Setup Prerequisites (One-Time)

Before running the MVP, these must be configured:

1. **Cloudflare RealtimeKit App**: Create via Dashboard at `dash.realtime.cloudflare.com` or API. Get `REALTIME_APP_ID`.
2. **RealtimeKit Presets**: Create `host` and `viewer` presets via API or Dashboard.
3. **Cloudflare API Token**: Create with "Realtime/Realtime Admin" permissions. Get `CF_API_TOKEN`.
4. **Deepgram Account**: Sign up at `deepgram.com`. Get API key ($200 free credits).
5. **Create `.dev.vars`** at `workers/rtc-worker/.dev.vars` with all secrets.

## Dependencies

**New npm packages:**

| Package | Version | Where | Purpose |
|---------|---------|-------|---------|
| `@cloudflare/realtimekit-react` | ^1.2.4 | apps/web | RealtimeKit React hooks |
| `hono` | ^4 | workers/rtc-worker | HTTP framework |
| `wrangler` | ^4 | workers/rtc-worker (dev) | CF Workers tooling |
| `@cloudflare/workers-types` | ^4 | workers/rtc-worker (dev) | Type definitions |

No Deepgram SDK needed — using raw WebSocket from browser with temporary tokens.

## Success Metrics

- Host can broadcast webcam + audio and viewers see/hear it in < 2 seconds
- Screen share takes over the video feed for all participants
- Deepgram transcription appears as subtitles within ~1-2 seconds of speech
- Works across two different browsers/computers on the same network
- Meeting stays stable for at least 30 minutes

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Deepgram Chinese code-switching not supported in `multi` mode | Reduced transcription quality for mid-sentence language switches | Use `detect_language=true` for per-utterance detection. Document as known limitation. |
| RealtimeKit SDK API changes | Build breaks | Pin to specific version (1.2.4) |
| Durable Object WebSocket complexity | Delays Phase 1 | Start with simple broadcast; DO handles connection lifecycle |
| Browser camera/mic permission UX varies | Confusing for hosts | Clear error messaging with "try viewer mode" fallback |
| CORS issues between web (:3000) and rtc-worker (:8787) | API calls fail | Follow proven auth-worker CORS pattern exactly |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-25-cloudflare-rtc-mvp-brainstorm.md](docs/brainstorms/2026-02-25-cloudflare-rtc-mvp-brainstorm.md) — Key decisions: RealtimeKit with custom UI, anonymous access, host/viewer presets, Deepgram transcription, overlaid captions, single room.

### Internal References

- Auth-worker pattern: `workers/auth-worker/src/index.ts` (Hono + CORS template)
- Auth-worker env types: `workers/auth-worker/src/env.d.ts`
- Auth-worker wrangler: `workers/auth-worker/wrangler.toml`
- Web routing: `apps/web/src/routes/index.tsx` (home page to modify)
- Web API client pattern: `apps/web/src/lib/auth-client.ts`
- Shared types: `packages/shared/src/types/index.ts`
- Turborepo config: `turbo.json`

### External References

- [RealtimeKit React Setup](https://docs.realtime.cloudflare.com/guides/live-video/client-setup/react)
- [RealtimeKit Presets](https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/)
- [RealtimeKit REST API](https://developers.cloudflare.com/api/resources/realtime_kit/)
- [Deepgram Live Streaming](https://developers.deepgram.com/docs/live-streaming-audio)
- [Deepgram Language Detection](https://developers.deepgram.com/docs/language-detection)
- [Deepgram Temporary Tokens](https://developers.deepgram.com/reference/auth/tokens/grant)
- [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/api/websockets/)
- [@cloudflare/realtimekit-react npm](https://www.npmjs.com/package/@cloudflare/realtimekit-react)
