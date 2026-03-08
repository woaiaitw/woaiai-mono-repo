# Research: Replacing Cloudflare RealtimeKit with Mux + OBS

**Date:** 2026-03-07
**Status:** Research / Evaluation

## Summary

This document evaluates replacing the current Cloudflare RealtimeKit WebRTC-based live streaming setup with **Mux** (video infrastructure API) + **OBS Studio** (broadcast software). The goal is a simpler architecture that is easier for non-technical users to operate.

---

## Current Architecture (Cloudflare RealtimeKit)

- **Model:** WebRTC video call (two-way capable, used one-to-many)
- **Backend:** Cloudflare Worker + Durable Object for WebSocket relay
- **Frontend:** Custom React UI with RealtimeKit SDK hooks
- **Transcription:** Deepgram via Durable Object audio relay (PCM16 @ 48kHz)
- **Features:** Host webcam/audio, screen share, viewer captions (EN + ZH-TW)
- **Complexity:** High — Durable Objects, WebSocket management, audio processing pipeline, custom participant state management

## Proposed Architecture (Mux + OBS)

- **Model:** One-to-many broadcast (like Twitch/YouTube Live)
- **Backend:** Single worker with ~3 endpoints (create stream, get status, webhook receiver)
- **Frontend:** `<MuxPlayer playbackId={id} />` React component
- **Transcription:** Mux built-in ASR (EN) + Deepgram for ZH-TW
- **Complexity:** Low — no Durable Objects, no WebSocket management, no audio pipeline

### Architecture Diagram

```
┌─────────────┐     RTMP      ┌──────────┐     HLS      ┌──────────────┐
│   Host +    │ ──────────────>│   Mux    │ ────────────> │   Viewers    │
│   OBS       │  stream key   │ (ingest, │  playback ID  │ (mux-player  │
│             │               │ transcode│               │  component)  │
└─────────────┘               │  CDN)    │               └──────────────┘
                              └──────────┘
                                   │
                                   │ webhooks
                                   ▼
                           ┌──────────────┐
                           │  Your API    │
                           │ (CF Worker)  │
                           └──────────────┘
                           - Create streams
                           - Manage stream keys
                           - Handle webhooks
                           - Serve playback pages
```

---

## Non-Technical User Workflow

### One-Time OBS Setup (~2 minutes)

1. Your app creates a Mux live stream via API → returns a `stream_key`
2. User opens OBS → Settings → Stream
3. Server: `rtmp://global-live.mux.com:5222/app`
4. Stream Key: paste the key from your app
5. Done

### Every Time They Stream

1. Open OBS
2. Click "Start Streaming"
3. That's it — Mux handles transcoding, CDN, recording

### For Viewers

- Your app embeds `<MuxPlayer playbackId="abc123" />` — works on every device/browser
- Standard HLS playback, adaptive bitrate, auto-poster images
- No WebRTC, no Durable Objects, no WebSocket management needed

---

## Mux API Reference

### Authentication

HTTP Basic Auth using Token ID + Token Secret (generated in Mux dashboard).

### Key Endpoints

| Action | Method | Endpoint | Purpose |
|--------|--------|----------|---------|
| Create stream | POST | `/video/v1/live-streams` | Returns stream key + playback ID |
| List streams | GET | `/video/v1/live-streams` | Filterable by status |
| Get stream | GET | `/video/v1/live-streams/{id}` | Status: `idle` / `active` / `disabled` |
| Delete stream | DELETE | `/video/v1/live-streams/{id}` | Remove a stream |
| Reset key | POST | `/video/v1/live-streams/{id}/reset-stream-key` | Security rotation |
| End stream | PUT | `/video/v1/live-streams/{id}/complete` | Triggers VOD creation |
| Disable | PUT | `/video/v1/live-streams/{id}/disable` | Block new RTMP sessions |
| Enable | PUT | `/video/v1/live-streams/{id}/enable` | Re-enable |
| Add simulcast | POST | `/video/v1/live-streams/{id}/simulcast-targets` | Restream to YouTube/Twitch |
| Manage playback IDs | POST/DELETE | `/video/v1/live-streams/{id}/playback-ids` | Create/delete playback IDs |

### Create Live Stream (Minimal)

```json
POST /video/v1/live-streams
{
  "playback_policies": ["public"],
  "new_asset_settings": { "playback_policies": ["public"] },
  "generated_subtitles": [{ "language_code": "en", "name": "English CC" }]
}
```

**Response includes:**
- `id` — unique live stream identifier
- `stream_key` — secret key for RTMP ingest (treat like a password)
- `playback_ids` — array of playback IDs for constructing HLS URLs
- `status` — `idle`, `active`, or `disabled`

### Playback URL

```
https://stream.mux.com/{PLAYBACK_ID}.m3u8
```

### OBS Configuration

- **Server:** `rtmp://global-live.mux.com:5222/app` (note: port 5222, not standard 1935)
- **RTMPS (encrypted):** `rtmps://global-live.mux.com/app`
- **Regional endpoints available:** e.g., `rtmp://us-east.live.mux.com:5222/app`
- **Stream Key:** from API response
- Stream keys are reusable — configure OBS once, stream forever

### Webhooks

Key events:
- `stream.connected` — RTMP feed received
- `stream.started` — stream is live
- `stream.ended` — stream stopped
- `video.asset.ready` — VOD recording available

---

## Mux Player Component

### Installation

```bash
npm install @mux/mux-player-react
```

### Usage (React)

```jsx
import MuxPlayer from '@mux/mux-player-react';

<MuxPlayer
  playbackId="YOUR_PLAYBACK_ID"
  accentColor="#your-brand-color"
  metadata={{
    video_id: 'video-id-123',
    video_title: 'My Stream',
    viewer_user_id: 'user-123',
  }}
/>
```

### Also available as

- **Web component:** `<mux-player playback-id="..."></mux-player>` via `@mux/mux-player`
- **Lazy-loading:** `import MuxPlayer from '@mux/mux-player-react/lazy'`
- **iframe embed:** `<iframe src="https://player.mux.com/{playbackId}">`

### Features

- Built on web components (Media Chrome) — works across React, Vue, Svelte, plain HTML
- Adaptive bitrate streaming (HLS.js under the hood)
- Automatic poster images and timeline hover thumbnails
- Fullscreen, picture-in-picture, Chromecast, AirPlay
- Integrated with Mux Data analytics (zero config)
- Responsive UI adapts to player dimensions and stream type
- Customizable via `accentColor`, CSS variables, and `::part()` selectors

---

## Latency Options

| Mode | Latency | Use Case |
|------|---------|----------|
| Standard | ~25-30s | Best video quality, most reliable |
| Reduced | ~12-20s | Good balance for most broadcasts |
| Low-latency (LL-HLS) | ~4-7s | Near-real-time feel |
| Sub-second (WebRTC) | <1s | Interactive, more complex setup |

**Recommendation:** Reduced latency for teaching/broadcast scenarios.

---

## Pricing

### Plans

| Plan | Cost | Credits |
|------|------|---------|
| Free | $0 (no credit card) | Up to 10 on-demand assets, 100K free delivery min/month |
| Launch | $20/month | $100 usage credits + 100K free delivery min |
| Scale | $500/month | $1,000 usage credits |
| Enterprise | Custom (~$3k+/month) | Lower rates, SSO, dedicated support |

### Per-Minute Rates

**Encoding (live streaming):**
- Plus quality: ~$0.032/min
- Premium (first 5,000 min): $0.0375/min (720p), $0.0469/min (1080p)

**Delivery (per minute streamed to viewers):**
- First 100,000 min/month: **FREE**
- 720p: $0.0008–$0.0012/min (volume dependent)
- 1080p: $0.001–$0.0015/min (volume dependent)

**Storage:**
- ~$0.0024–$0.003/min stored per month
- Auto cold storage: 40% discount after 30 days, 60% after 90 days

**Add-ons:**
- Auto-generated live captions: 6,000 min/month free, then $0.024/min
- Simulcasting: $0.02/min per target
- DRM: $100/month + $0.003/license

### Test Mode

- Include `"test": true` when creating an asset
- Free, watermarked, duration-limited
- Auto-deleted after 24 hours
- Cannot be converted to non-test

---

## Tradeoffs

### What You'd Gain

1. **Massively simpler architecture** — No Durable Objects, no WebSocket relay, no RealtimeKit SDK
2. **OBS is the industry standard** — non-technical streamers already know it, tons of tutorials
3. **Automatic VOD** — every stream auto-becomes a replayable on-demand video
4. **Built-in auto-captions** — Mux ASR supports English and several other languages
5. **Simulcast** — restream to YouTube/Twitch simultaneously (up to 6 targets)
6. **No idle costs** — only pay when actively streaming/delivering
7. **Better scalability** — CDN delivery scales infinitely, no participant limits

### What You'd Lose

1. **Two-way video** — Mux is one-to-many broadcast only. No viewer webcams
2. **Sub-5s latency** — unless using WebRTC mode, there's noticeable delay
3. **Chinese transcription** — Mux ASR doesn't support zh-TW. Still need Deepgram for that
4. **Browser-based streaming** — current setup lets hosts stream from browser. OBS requires app install
5. **Screen share from browser** — with OBS, hosts switch scenes in OBS instead (standard for streamers, but different UX)

### Is It Right for Your Use Case?

**Good fit if:**
- Primary use case is one-to-many broadcasting (lectures, presentations, live events)
- Hosts are willing to use OBS (standard for any serious streamer)
- You want automatic recording/VOD
- You want simpler infrastructure to maintain

**Not a good fit if:**
- You need interactive two-way video (meetings, collaboration)
- Zero-install browser streaming for hosts is a hard requirement
- Sub-second latency is critical for interaction

---

## Recommended Next Steps

1. **Create a Mux test account** — free, no credit card required
2. **Prototype the API integration** — single worker with create/status/webhook endpoints
3. **Test OBS workflow** — verify the user experience for stream setup
4. **Evaluate latency** — test reduced-latency mode for your use case
5. **Decide on transcription** — Mux ASR for English, keep Deepgram for Chinese
6. **Build viewer page** — simple page with `<MuxPlayer>` component

---

## Sources

- [Start live streaming | Mux](https://www.mux.com/docs/guides/start-live-streaming)
- [Live Streams API Reference | Mux](https://www.mux.com/docs/api-reference/video/live-streams)
- [Configure broadcast software | Mux](https://www.mux.com/docs/guides/configure-broadcast-software)
- [Manage stream keys | Mux](https://www.mux.com/docs/guides/manage-stream-keys)
- [Mux Pricing](https://www.mux.com/pricing)
- [Understanding Mux Video Pricing](https://www.mux.com/docs/pricing/video)
- [Integrate Mux Player into your web application](https://www.mux.com/docs/guides/player-integrate-in-your-webapp)
- [@mux/mux-player-react on npm](https://www.npmjs.com/package/@mux/mux-player-react)
- [Mux Player for web](https://www.mux.com/docs/guides/mux-player-web)
- [Live Streaming FAQs | Mux](https://www.mux.com/docs/guides/live-streaming-faqs)
- [The State of Going Live from a Browser | Mux Blog](https://www.mux.com/blog/the-state-of-going-live-from-a-browser)
- [Mux Free Plan Blog Post](https://www.mux.com/blog/free-plan)
- [Mux Elements GitHub Repo](https://github.com/muxinc/elements)
