# Restream.io Integration Research

## Context

The current app (woaiai.tw) uses Cloudflare RealtimeKit for WebRTC-based video meetings with host/viewer roles, plus Deepgram live transcription. The goal is to switch to **Restream.io** for streaming and recording Google Meet sessions, supporting up to 3 concurrent streams. Deepgram will be dropped (poor real-time performance); Google Meet's built-in transcription will be used instead.

---

## Key Finding: Google Meet Does NOT Support Custom RTMP Output

Google Meet cannot natively output to RTMP/Restream. Its only streaming options are:
- Internal Workspace live streams (Enterprise editions only)
- YouTube live streaming

This is the core challenge. Below are the viable approaches to bridge Google Meet → Restream.

---

## Option A: Restream Studio Tab-Share (Simplest, Manual)

**How it works:**
1. Host opens Google Meet in one browser tab
2. Host opens Restream Studio in another tab
3. In Restream Studio, host clicks "Add Scene" → "Media" → "Screen" and shares the Google Meet browser tab (with "share tab audio" checked)
4. Restream Studio captures the Google Meet session and streams/records it

**Pros:**
- No additional service costs beyond Restream plan
- Works today with no API integration needed
- Host has full control of what's shared
- Google Meet's live transcription remains available to meeting participants

**Cons:**
- Manual setup each time (host must share the correct tab)
- Video quality depends on screen capture (not native stream quality)
- Host must keep both tabs open throughout the session
- Presenter handoff: new presenter joins Google Meet, host toggles screen share in Restream Studio

**Best for:** Quick MVP, low-volume usage

---

## Option B: Recall.ai Bot (Automated, API-Driven)

**How it works:**
1. Recall.ai bot joins Google Meet as a participant (no host permissions needed)
2. Bot captures audio + video and outputs an RTMP stream
3. RTMP stream is sent to Restream's ingest URL
4. Restream distributes to configured channels and records

**Pros:**
- Fully automated — no manual screen capture
- Works on ALL Google Meet tiers (including free accounts)
- 720p @ 30fps RTMP output
- Unlimited concurrent bots
- API-driven: programmatically create bots, start/stop capture
- SOC 2, ISO 27001, GDPR, HIPAA compliant

**Cons:**
- Additional cost: ~$0.50/hr per bot (prorated to the second)
- Adds a visible "bot participant" to the Google Meet
- Introduces a third service in the chain (Google Meet → Recall.ai → Restream)
- Google Meet transcription is for meeting participants only (not in the RTMP output)

**Pricing:** Pay As You Go: $0.50/hr per bot. Volume discounts available.

**Best for:** Production use, automated workflows, multiple concurrent streams

---

## Option C: Replace Google Meet with Restream Studio (All-in-One)

**How it works:**
1. Drop Google Meet entirely
2. Use Restream Studio as both the meeting AND streaming platform
3. Invite participants via shareable link (no account needed)
4. Stream and record natively

**Pros:**
- Simplest architecture — one platform for everything
- Built-in guest support (up to 9 guests on paid plans)
- Native recording and streaming
- Built-in screen sharing for presenters
- Guest invite via link, no account needed
- Presenter handoff: toggle guests on/off screen

**Cons:**
- Loses Google Meet's live transcription (user's primary reason for Google Meet)
- Restream Studio has its own captioning but quality/language support may differ
- Participants must use Restream Studio instead of familiar Google Meet

**Best for:** If transcription quality is not the primary concern

---

## Restream API (v2)

Base URL: `https://api.restream.io/v2`

### Authentication
- OAuth2 with scopes: `profile.read`, `stream.read`, `channel.read`
- App registration: https://developers.restream.io/apps
- Full docs: https://developers.restream.io/docs

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/oauth/token` | OAuth2 token exchange |
| GET | `/user/profile` | Get user profile |
| GET | `/user/channels` | List connected streaming channels |
| GET | `/user/channels/:id` | Get channel details |
| PATCH | `/user/channels/:id` | Enable/disable channel |
| GET | `/user/stream` | Get current stream info (RTMP URL, key) |
| PATCH | `/user/stream` | Update stream settings |
| POST | `/user/stream/start` | Start streaming |
| POST | `/user/stream/stop` | Stop streaming |
| GET | `/user/analytics` | Streaming analytics |

### Webhooks
Restream supports webhooks for stream events (start, stop, etc.)

---

## Restream Pricing

| Plan | Monthly | Annual | Channels | Key Features |
|------|---------|--------|----------|--------------|
| Free | $0 | $0 | 2 | Watermark, 720p |
| Standard | $19 | $16/mo | 3 | No watermark, custom graphics |
| Professional | $49 | $39/mo | 5 | 1080p, recordings, RTMP pull, team access |
| **Business** | $299 | **$199/mo** | 8 | **Website embed player**, SRT ingest, priority support |

### Embed Player Availability
**The embeddable website player (iframe) requires the Business plan ($199/mo).** It is NOT available on Standard ($19) or Professional ($49). There is no $50/mo plan that includes embed.

### Concurrent Events
- Up to 15 concurrent events from one account
- Available on all plans (including free)
- Each concurrent event needs its own RTMP key

### Recording
- Available on Professional+ plans
- Recordings retained for limited time on lower tiers (15 days reported)
- Download in video/audio formats

---

## Presenter Handoff Options

### In Restream Studio (Option A or C):
- Host toggles guests on/off screen via Sources panel
- New presenter starts screen share; host switches the active source
- Guest invite link is static per event — new presenter can join anytime

### With Recall.ai (Option B):
- Handoff happens within Google Meet itself (standard Meet presenter controls)
- Recall.ai bot captures whatever is shown in the meeting
- No Restream-side changes needed for handoff

---

## Recommended Architecture

### For Your Use Case (Google Meet + streaming + recording + 3 concurrent):

**Option B (Recall.ai)** is the most robust automated solution:

```
Google Meet ──→ Recall.ai Bot ──→ RTMP ──→ Restream ──→ YouTube/Facebook/etc.
                                                    └──→ Recording
```

**Cost estimate for 3 concurrent 1-hour streams:**
- Recall.ai: 3 × $0.50 = $1.50/hr
- Restream Professional: $39/mo (or Business at $199/mo for embed)

**However, Option A (tab sharing)** is the cheapest and simplest if you're okay with manual setup:

```
Host Browser:
├── Tab 1: Google Meet (meeting + transcription)
└── Tab 2: Restream Studio (captures Tab 1 via screen share → streams/records)
```

**Cost: Just the Restream plan ($39-199/mo), no additional services.**

---

## Integration with Current Codebase

### What changes:
- Remove: Cloudflare RealtimeKit SDK, Deepgram integration, caption system
- Remove/repurpose: `rtc-worker`, `LiveMeetingPanel`, `VideoGrid`, `HostControls`, `CaptionOverlay`, caption hooks
- Add: Restream OAuth2 flow, stream management API, Google Meet link generation
- Update: Home page flow, meeting page, shared types

### What stays:
- Tanstack Router, Tailwind CSS, Hono workers framework
- General app structure and deployment (Cloudflare Workers/Pages)

---

## Next Steps

1. **Decide on approach** (Option A vs B vs C)
2. **Decide on Restream plan** (Professional $39/mo vs Business $199/mo for embed)
3. Register app at https://developers.restream.io/apps
4. Implement OAuth2 flow
5. Build stream management UI
6. Test with 3 concurrent streams

---

## Sources

- [Restream Developer Portal](https://developers.restream.io/docs)
- [Restream Pricing](https://restream.io/pricing)
- [Restream Web Player](https://restream.io/web-player)
- [Restream Studio Integrations](https://restream.io/integrations/restream-studio/)
- [Restream Guest Invites](https://support.restream.io/en/articles/8540529-how-to-invite-guests-in-studio)
- [Restream Concurrent Events](https://support.restream.io/en/articles/6673806-host-parallel-streams-with-concurrent-events)
- [Restream Screen Share](https://support.restream.io/en/articles/8540694-screen-share-on-your-stream-in-studio)
- [Restream RTMP Source](https://restream.io/blog/rtmp-source-in-restream-studio/)
- [Google Meet Live Streaming](https://support.google.com/meet/answer/9308630)
- [Recall.ai Meeting Bot API](https://www.recall.ai/product/meeting-bot-api)
- [Recall.ai Google Meet](https://www.recall.ai/product/meeting-bot-api/google-meet)
- [Recall.ai Pricing](https://www.recall.ai/pricing)
- [Recall.ai RTMP Streaming Blog](https://www.recall.ai/blog/how-to-live-stream-the-video-from-zoom-microsoft-teams-and-google-meet-video-conferences)
