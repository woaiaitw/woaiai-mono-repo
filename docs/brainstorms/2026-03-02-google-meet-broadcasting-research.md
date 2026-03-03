# Research: Google Meet Broadcasting via Cloudflare or YouTube

## Context

Evaluate options for hosting meetings in Google Meet (with transcription) and broadcasting them to the public internet via Cloudflare Stream or YouTube Live.

---

## Part 1: Google Meet Transcription Options

### Option A: Google Meet Built-In Transcription (Gemini)

- **Requires:** Google Workspace Business Standard ($14/user/mo) or higher
- **How it works:** Click "Take notes with Gemini" during a meeting. Transcript is saved as a Google Doc in the organizer's Drive.
- **Languages:** English, French, German, Italian, Japanese, Korean, Portuguese, Spanish
- **Limitations:**
  - Desktop only (no mobile)
  - No speaker labels in basic transcription
  - All participants are notified that transcription is active
  - Accuracy degrades with background noise, accents, or crosstalk
  - Transcript is cloud-only (Google Drive), must manually download
- **Pros:** Zero setup, native integration, no extra tools
- **Cons:** Limited language support, no real-time API access to transcript data, locked to Google Drive

### Option B: Third-Party Chrome Extension Transcription

Several extensions capture transcription directly from the browser tab:

| Extension | Bot-Free? | Real-Time? | API/Export? | Notes |
|-----------|-----------|------------|-------------|-------|
| **Tactiq** | Yes | Yes | Export to Docs, Notion, etc. | Most popular; scrapes captions from DOM |
| **Fireflies.ai** | Yes (Chrome ext) | Yes | API available, integrations with CRM/PM tools | Also has bot-based option |
| **Otter.ai** | Yes | Yes | Export; limited API on paid plans | Captures internal browser audio |
| **MeetGeek** | Yes | Yes | API + Zapier/Make integrations | 8,000+ app integrations |

- **How they work:** Extensions either (a) scrape the live captions from the Google Meet DOM, or (b) capture tab audio via `chrome.tabCapture` API and send to their own ASR engine.
- **Pros:** No bot joins the call, richer features (speaker labels, AI summaries), some have APIs for programmatic access
- **Cons:** Requires each user to install extension, Chrome-only, potential privacy/compliance concerns with third-party services

### Option C: Build a Custom Chrome Extension

- Use `chrome.tabCapture` API to capture the meeting's audio stream
- Send audio to any ASR service (Deepgram, AssemblyAI, Whisper, etc.)
- Full control over transcript data, language, and output
- **Reference:** [Recall.ai open-source Chrome extension](https://github.com/recallai/chrome-recording-transcription-extension) demonstrates this pattern
- **Pros:** Full control, no third-party lock-in, can integrate with your own backend
- **Cons:** Development effort, Chrome Web Store publishing requirements, maintaining the extension

---

## Part 2: Broadcasting Google Meet to the Internet

### Option 1: Google Meet Native YouTube Live Stream

- **Requires:** Google Workspace **Enterprise** plan (custom pricing, contact Google Sales)
- **Setup:**
  1. Admin enables "Let People Stream Their Meetings" and "Let People Use YouTube to Stream Meetings" in Admin Console
  2. YouTube channel must be set up for live streaming 24+ hours in advance
  3. During meeting: Activities > Live Streaming > "Stream with YouTube"
- **Capacity:** Up to 100,000 viewers (in-domain)
- **Pros:** Zero extra software, native integration, one-click setup during meeting
- **Cons:** Requires Enterprise plan (expensive), YouTube only (no Cloudflare), limited to domain viewers by default, no custom player/embed control

### Option 2: OBS Window Capture + RTMP to Cloudflare Stream

This is the most flexible approach and supports both Cloudflare and YouTube.

**Architecture:**
```
Google Meet (browser)
    --> OBS (Window Capture of Meet tab)
        --> RTMP/RTMPS to Cloudflare Stream Live Input
            --> Cloudflare player (embed anywhere)
            --> Simulcast to YouTube, Twitch, etc. (up to 50 destinations)
```

**Setup:**
1. Open Google Meet in browser
2. In OBS, add a **Window Capture** source targeting the Meet browser window
3. Add an **Audio Output Capture** source for meeting audio
4. In OBS Settings > Stream, set service to "Custom" and paste Cloudflare's RTMPS URL + stream key
5. Cloudflare encodes into multiple quality levels automatically
6. Optionally configure simulcast outputs in Cloudflare dashboard to also push to YouTube

**Cloudflare Stream Pricing:**
- $5/1,000 minutes stored (live streams are auto-recorded)
- $1/1,000 minutes delivered to viewers
- No extra cost for ingest, encoding, or egress
- Starter bundle: $10/month for 5,000 minutes

**OBS Settings for Cloudflare (recommended):**
- Keyframe interval: 2-4 seconds
- Rate control: CBR (not VBR)
- For lowest latency: keyframe interval of 1-2s, "ultra low" latency profile

**Pros:** Full control over broadcast, works with Cloudflare AND YouTube, free software (OBS), can add overlays/branding, Cloudflare pricing is very affordable
**Cons:** Requires a dedicated machine running OBS, manual setup per meeting, slight additional latency (OBS capture + RTMP encode)

### Option 3: OBS Multi-RTMP Plugin (Direct Multi-Platform)

Same as Option 2 but skip Cloudflare as the relay — stream directly from OBS to multiple platforms simultaneously.

- Install the **Multiple RTMP Outputs** OBS plugin
- Add separate RTMP targets for YouTube, Cloudflare, Twitch, etc.
- **Caveat:** Each additional target doubles your upload bandwidth usage. Upload bandwidth should be 2x the bitrate per target.
- **Pros:** No middleman service, direct to each platform
- **Cons:** High bandwidth requirements, CPU-intensive, no unified analytics

### Option 4: Browser-Based Studio (StreamYard / OneStream Live)

- **StreamYard** or **OneStream Live** provide browser-based broadcast studios
- Can bring in Google Meet participants or share a browser tab
- Push to YouTube, Cloudflare (custom RTMP), Facebook, LinkedIn, Twitch simultaneously
- **OneStream Live** has a Chrome extension for one-click studio sessions
- **Pros:** No OBS needed, browser-only workflow, built-in multistreaming
- **Cons:** Monthly subscription ($20-50+/mo), less control than OBS, additional service dependency

### Option 5: Custom Chrome Extension + WebRTC-to-RTMP Bridge

Build a Chrome extension that captures the Google Meet tab and bridges to a broadcast:

- Use `chrome.tabCapture` to get a `MediaStream` of the Meet tab
- Option A: Send via WebRTC to a server running FFmpeg that re-encodes to RTMP
- Option B: Use Cloudflare Stream's WHIP (WebRTC) endpoint directly
- **Pros:** Fully automated, no OBS needed, could be a one-click solution
- **Cons:** Significant development effort, WHIP/WHEP is still beta on Cloudflare, requires server infrastructure for the WebRTC-to-RTMP bridge

---

## Recommendation Summary

| Approach | Transcription | Broadcast Target | Cost | Complexity | Best For |
|----------|--------------|------------------|------|------------|----------|
| **Meet Native + YouTube** | Built-in (Gemini) | YouTube only | Enterprise plan ($$$$) | Low | Orgs already on Workspace Enterprise |
| **Meet + OBS + Cloudflare** | Extension (Tactiq/Fireflies) or built-in | Cloudflare + YouTube (simulcast) | ~$14/mo Workspace + ~$10/mo Cloudflare + OBS (free) | Medium | **Best balance of control, cost, and flexibility** |
| **Meet + StreamYard/OneStream** | Extension or built-in | YouTube + custom RTMP | ~$14/mo Workspace + ~$25-50/mo studio | Low-Medium | Non-technical users wanting multi-platform |
| **Meet + Custom Extension** | Custom (Deepgram, etc.) | Cloudflare or YouTube | Dev time + ASR costs + Cloudflare | High | Full control, automation, custom integration |

### Recommended Path: **Option 2 (OBS + Cloudflare Stream)**

This gives you:
- **Google Meet** for hosting the meeting (familiar UX, screen share, etc.)
- **Transcription** via a Chrome extension like Tactiq or Fireflies (or Meet's built-in if on Business Standard+)
- **OBS** to capture the Meet window and encode to RTMP (free, battle-tested)
- **Cloudflare Stream** to receive the broadcast, auto-encode to multiple quality levels, and deliver to viewers via an embeddable player
- **Simulcast** from Cloudflare to YouTube if you also want a YouTube audience
- Total cost: ~$24/month (Workspace Business Standard $14 + Cloudflare Stream $10)

---

## V1 Recommended Architecture (Based on Requirements)

**Requirements clarified:**
- Live transcription: Google Meet's built-in closed captions (visible to meeting participants)
- Post-meeting transcription: Separate transcription service (e.g., Deepgram, AssemblyAI, Otter)
- Broadcast destination: Embedded Cloudflare Stream player (YouTube not required)
- Priority: Flexibility over ease of use

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  HOST MACHINE                    │
│                                                  │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │ Google Meet   │     │ OBS Studio           │  │
│  │ (Chrome tab)  │────>│ - Window Capture      │  │
│  │              │     │ - Audio Output Capture │  │
│  │ [CC enabled] │     │ - Overlays/branding   │  │
│  └──────────────┘     └──────────┬───────────┘  │
│                                  │ RTMPS         │
└──────────────────────────────────┼───────────────┘
                                   │
                                   v
                    ┌──────────────────────────┐
                    │   Cloudflare Stream       │
                    │   (Live Input)            │
                    │                           │
                    │ - Auto multi-quality HLS  │
                    │ - Auto-recording          │
                    │ - Embeddable player       │
                    │ - Optional simulcast      │
                    └──────────────┬────────────┘
                                   │
                    ┌──────────────┴────────────┐
                    │                           │
                    v                           v
          ┌─────────────────┐     ┌──────────────────┐
          │ Your Website    │     │ Post-Meeting      │
          │ (Cloudflare     │     │ Transcription     │
          │  Stream embed)  │     │ (upload recording │
          │                 │     │  to Deepgram /    │
          │ Viewers watch   │     │  AssemblyAI /     │
          │ live broadcast  │     │  Whisper)         │
          └─────────────────┘     └──────────────────┘
```

### V1 Step-by-Step Setup

1. **Google Meet** — Host the meeting normally with closed captions enabled
2. **OBS Studio** — Window-capture the Meet browser tab + audio output capture
3. **Cloudflare Stream** — Create a Live Input, copy RTMPS URL + key into OBS
4. **Embed** — Place the Cloudflare Stream `<iframe>` player on your site
5. **Post-meeting** — Download the auto-recorded video from Cloudflare Stream and send to your transcription service of choice

### Cost Estimate (V1)

| Item | Cost |
|------|------|
| Google Workspace (Business Standard, for Meet CC) | $14/user/mo |
| Cloudflare Stream (starter) | ~$10/mo |
| OBS Studio | Free |
| Post-meeting transcription (e.g., Deepgram) | ~$0.0043/min (pay-as-you-go) |
| **Total** | **~$24/mo + transcription usage** |

### Future Enhancements (V2+)

- **Custom Chrome extension** to capture tab audio and stream directly via WHIP (no OBS needed)
- **Real-time caption overlay on broadcast** by piping Deepgram output as a browser source in OBS
- **Automated recording download + transcription** via Cloudflare Stream webhooks + serverless worker
- **Simulcast to YouTube** if broader reach is needed later

---

## Website ↔ OBS/Cloudflare Stream Integration

The core question: once someone starts streaming from OBS to Cloudflare, how does your website know a feed exists and automatically show it to viewers?

Cloudflare Stream provides **three complementary mechanisms** for this.

### Mechanism 1: Webhooks (Push — Server-Side)

Cloudflare sends HTTP POST requests to your server when a stream connects or disconnects.

**Setup:**
```bash
# Register your webhook endpoint (one per account)
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/stream/webhook" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationUrl": "https://your-site.com/api/stream/webhook"}'
```

**Event types:**
| Event | Fires When |
|-------|-----------|
| `live_input.connected` | OBS starts streaming to the Live Input |
| `live_input.disconnected` | OBS stops streaming / stream drops |
| `live_input.errored` | Bad codec, GOP out of range, quota exceeded, etc. |

**Webhook payload includes:**
- `event_type` — one of the three above
- Input ID — which Live Input triggered the event
- Timestamp — when the event occurred
- `Webhook-Signature` header — HMAC signature for verification

**Your server would:**
1. Receive `live_input.connected`
2. Update a database flag or broadcast via WebSocket to connected clients: "stream is live"
3. Receive `live_input.disconnected`
4. Clear the flag / notify clients: "stream ended"

**Filtering:** You can limit webhooks to specific Live Input IDs (comma-delimited list in the dashboard) so you only get notified for your meeting input.

### Mechanism 2: Lifecycle Endpoint (Poll — Client-Side or Server-Side)

A lightweight JSON endpoint that tells you whether a Live Input is currently broadcasting.

**Endpoint:**
```
GET https://customer-<CODE>.cloudflarestream.com/<LIVE_INPUT_ID>/lifecycle
```

**Response when live:**
```json
{
  "isInput": true,
  "videoUID": "55b9b5ce48c3968c6b514c458959d6a",
  "live": true
}
```

**Response when idle:**
```json
{
  "isInput": true,
  "videoUID": null,
  "live": false
}
```

**Usage:** Your website can poll this endpoint every few seconds from the client or server. When `live` flips to `true`, show the player. When it flips to `false`, show "stream ended" or the recording.

### Mechanism 3: Built-In Stream Player (Automatic — Zero Code)

The Cloudflare Stream Player iframe **automatically handles live detection** when you embed it using the Live Input ID (not a Video ID).

**Iframe embed:**
```html
<iframe
  src="https://customer-<CODE>.cloudflarestream.com/<LIVE_INPUT_ID>/iframe?autoplay=true&muted=true"
  style="border: none; width: 100%; aspect-ratio: 16/9;"
  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
  allowfullscreen
></iframe>
```

**React component:**
```bash
npm install @cloudflare/stream-react
```

```tsx
import { Stream } from "@cloudflare/stream-react";

function LivePlayer({ liveInputId }: { liveInputId: string }) {
  return (
    <Stream
      controls
      src={liveInputId}
      autoplay
      muted
      responsive
    />
  );
}
```

**Behavior:**
- If the Live Input is **actively streaming** → player auto-plays the live feed
- If the Live Input is **idle** → player shows "Stream has not started"
- If a broadcast **just ended** → recording is available within ~60 seconds; player can replay it

**Key insight:** Use the **Live Input ID** (not a per-broadcast Video ID) so the same embed always shows whatever is currently live or the most recent recording.

### Recommended Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       YOUR WEBSITE                              │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │ /api/stream/     │    │ Frontend (React)                 │  │
│  │   webhook        │    │                                  │  │
│  │                  │    │  1. On page load, poll lifecycle  │  │
│  │ Receives:        │    │     endpoint to check if live    │  │
│  │ - connected      │───>│  2. If live, show <Stream> embed │  │
│  │ - disconnected   │ WS │  3. If idle, show "no stream"   │  │
│  │                  │    │     or upcoming schedule         │  │
│  │ Updates DB +     │    │  4. Listen for WebSocket push    │  │
│  │ broadcasts via   │    │     for instant state changes    │  │
│  │ WebSocket        │    │                                  │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ▲
                    │ POST (webhook)
                    │
         ┌──────────┴──────────┐
         │  Cloudflare Stream  │
         │  (Live Input)       │
         └──────────▲──────────┘
                    │ RTMPS
                    │
         ┌──────────┴──────────┐
         │  OBS Studio         │
         │  (Window Capture    │
         │   of Google Meet)   │
         └─────────────────────┘
```

### Implementation Options (Simplest → Most Robust)

**Option A: Embed-only (zero backend work)**
- Embed the Stream player using the Live Input ID
- Player auto-detects live/idle state
- No server-side code needed
- **Limitation:** No custom UI around the player state (e.g., no "LIVE" badge, no notification)

**Option B: Lifecycle polling (minimal backend)**
- Frontend polls `lifecycle` endpoint every 5-10 seconds
- When `live: true`, show the player + "LIVE" badge
- When `live: false`, show schedule or "no active broadcast"
- **Limitation:** Up to 10s delay in detecting stream start/stop

**Option C: Webhooks + WebSocket (real-time, recommended)**
- Register a webhook endpoint on your server
- On `live_input.connected`: update DB, push to clients via WebSocket
- On `live_input.disconnected`: update DB, push to clients
- Frontend subscribes to WebSocket for instant state changes
- Falls back to lifecycle polling if WebSocket disconnects
- **Advantage:** Near-instant detection, works well with your existing Durable Object WebSocket infrastructure

### After the Stream Ends

- Cloudflare auto-records every live stream
- Recording is available within ~60 seconds after broadcast ends
- If using the Live Input ID embed, the player can replay the most recent recording
- To get all recordings: `GET /api/stream/live_inputs/<INPUT_ID>/videos` — filter for `state: "ready"`
- You can then send the recording to your post-meeting transcription service

### Cloudflare Stream API Quick Reference

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create Live Input | POST | `/accounts/{id}/stream/live_inputs` |
| Get Live Input | GET | `/accounts/{id}/stream/live_inputs/{input_id}` |
| List Live Inputs | GET | `/accounts/{id}/stream/live_inputs` |
| Check if live | GET | `https://customer-<CODE>.cloudflarestream.com/<INPUT_ID>/lifecycle` |
| List recordings | GET | `/accounts/{id}/stream/live_inputs/{input_id}/videos` |
| Register webhook | PUT | `/accounts/{id}/stream/webhook` |
| Enable/disable input | PATCH | `/accounts/{id}/stream/live_inputs/{input_id}` with `{"enabled": false}` |

---

## Verification / Next Steps

1. Confirm which Google Workspace plan you're on (or willing to get)
2. Set up a Cloudflare Stream account and create a test Live Input
3. Install OBS and test window capture of a Google Meet session
4. Test end-to-end: Meet -> OBS -> Cloudflare -> embedded player on your site
5. Choose a post-meeting transcription service and test with a recorded meeting

## Sources

- [Google Meet YouTube Live Streaming Guide](https://guidebooks.google.com/google-workspace-businesses/enhanced-meetings-google-meet/live-stream-meeting-youtube)
- [Google Workspace Pricing](https://workspace.google.com/pricing)
- [Cloudflare Stream - Start a Live Stream](https://developers.cloudflare.com/stream/stream-live/start-stream-live/)
- [Cloudflare Stream Pricing](https://developers.cloudflare.com/stream/pricing/)
- [Cloudflare Stream Simulcasting](https://developers.cloudflare.com/stream/stream-live/simulcasting/)
- [Cloudflare Stream WebRTC (WHIP/WHEP)](https://developers.cloudflare.com/stream/webrtc-beta/)
- [Chrome tabCapture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Recall.ai Open Source Chrome Extension](https://github.com/recallai/chrome-recording-transcription-extension)
- [The State of Going Live from a Browser (Mux)](https://www.mux.com/blog/the-state-of-going-live-from-a-browser)
- [Tactiq - Google Meet Transcription](https://tactiq.io/transcribe/google-meet)
- [Fireflies Chrome Extension](https://fireflies.ai/product/chrome-extension)
- [OneStream Live Studio Chrome Extension](https://onestream.live/integrations/studio-for-chrome/)
- [OBS Multi-RTMP Plugin Guide](https://www.obsbot.com/blog/live-streaming/obs-rtmp-plug-in)
- [Google Meet Built-In Transcription](https://support.google.com/meet/answer/12849897?hl=en)
- [Cloudflare Stream Live Webhooks](https://developers.cloudflare.com/stream/stream-live/webhooks/)
- [Cloudflare Stream Watch a Live Stream](https://developers.cloudflare.com/stream/stream-live/watch-live-stream/)
- [Cloudflare Stream Player](https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/)
- [Cloudflare Stream Player API](https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/using-the-player-api/)
- [@cloudflare/stream-react (npm)](https://www.npmjs.com/package/@cloudflare/stream-react)
- [@cloudflare/stream-react (GitHub)](https://github.com/cloudflare/stream-react)
- [Cloudflare Stream API - Live Inputs](https://developers.cloudflare.com/api/resources/stream/subresources/live_inputs/)
