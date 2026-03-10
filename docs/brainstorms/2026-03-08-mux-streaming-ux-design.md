# Mux Streaming UX/UI Design

**Date:** 2026-03-08
**Status:** Design
**Builds on:** [2026-03-07-mux-obs-streaming-research.md](./2026-03-07-mux-obs-streaming-research.md)

---

## Overview

This document defines the UX/UI flow for the Mux + OBS live streaming feature. The design prioritizes non-technical users by:

- Eliminating manual link sharing (streams are discoverable on the homepage)
- Providing a guided OBS setup experience
- Giving hosts a private preview before going live
- Making past recordings publicly accessible

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Host UX model | Dashboard | Hosts stream regularly; a management hub is more efficient than a wizard each time |
| Stream discovery | Homepage-based | Viewers find streams on the homepage, no manual link sharing needed |
| Go-live transition | Preview → Go Live | Host can connect OBS and verify their feed privately before broadcasting to viewers |
| Metadata storage | D1 + Mux | D1 stores event metadata (title, schedule, status); Mux handles video pipeline |
| VOD access | Public on homepage | Past recordings are browsable by anyone — fits the educational content use case |
| Scheduling | Basic scheduling | Host sets a title + start time; viewers see a countdown; stream still requires manual OBS start |

---

## Data Model

### `streams` table (Cloudflare D1)

```sql
CREATE TABLE streams (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TEXT NOT NULL,           -- ISO 8601 datetime
  status          TEXT DEFAULT 'scheduled', -- scheduled | preview | live | ended
  mux_stream_id   TEXT,                    -- Mux live stream ID (created lazily)
  mux_playback_id TEXT,                    -- Mux playback ID for viewer embed
  mux_asset_id    TEXT,                    -- Mux VOD asset ID (set via webhook)
  created_by      TEXT NOT NULL,           -- user ID (from auth)
  created_at      TEXT DEFAULT (datetime('now')),
  ended_at        TEXT
);
```

### Stream Status State Machine

```
scheduled ──[OBS connects]──→ preview ──[Host clicks Go Live]──→ live ──[Host ends stream]──→ ended
                                  │                                          │
                                  │←──[OBS disconnects]──────────────────────┘
                                  │    (auto-reverts to preview if brief)
                                  │
                                  └──[Host ends without going live]──→ ended
```

---

## Screens & UI Components

### 1. Homepage — Stream Discovery

The homepage is the central hub for all users. It displays three sections based on stream status.

```
┌─────────────────────────────────────────────────────────┐
│  woaiai                                                  │
│                                                          │
│  🔴 LIVE NOW                                            │
│  ┌────────────────────────────────────────────────┐     │
│  │  "Monday Grammar Lecture"                       │     │
│  │  Started 15 min ago · 24 watching               │     │
│  │  [Watch Now →]                                  │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  UPCOMING                                                │
│  ┌────────────────────────────────────────────────┐     │
│  │  "Wednesday Vocabulary"                         │     │
│  │  Mar 10 · 3:00 PM (in 2 days)                   │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │  "Friday Conversation Practice"                 │     │
│  │  Mar 12 · 7:00 PM (in 4 days)                   │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  PAST RECORDINGS                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  📼 "Last Friday's Session" · 1h 23m            │     │
│  │  📼 "Monday Review" · 45m                       │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  [+ Schedule New Stream]  ← visible to hosts only       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Polls `/api/streams?status=live,scheduled,ended` every 15-30 seconds
- Live streams sort first, then upcoming by date, then past by recency
- `[+ Schedule New Stream]` only appears for users with `owner` or `admin` roles
- Clicking a live stream → viewer page (or host dashboard if you're the host)
- Clicking an upcoming stream → countdown page (or host dashboard if host)
- Clicking a past recording → VOD player page

---

### 2. Schedule Modal

Triggered by `[+ Schedule New Stream]` on the homepage.

```
┌─── Schedule a Stream ────────────────────────┐
│                                                │
│  Title *                                       │
│  ┌──────────────────────────────────────┐     │
│  │ Monday Grammar Lecture               │     │
│  └──────────────────────────────────────┘     │
│                                                │
│  Description (optional)                        │
│  ┌──────────────────────────────────────┐     │
│  │ Covering past tense and irregular    │     │
│  │ verbs                                │     │
│  └──────────────────────────────────────┘     │
│                                                │
│  Date *              Time *                    │
│  ┌──────────────┐   ┌──────────────┐          │
│  │ Mar 10, 2026 │   │ 3:00 PM      │          │
│  └──────────────┘   └──────────────┘          │
│                                                │
│           [Cancel]   [Schedule Stream]          │
│                                                │
└────────────────────────────────────────────────┘
```

**Behavior:**
- `POST /api/streams` with title, description, scheduled_at
- Does NOT create a Mux live stream yet (lazy creation)
- On success, stream appears in "Upcoming" on homepage
- Validates that scheduled_at is in the future

---

### 3. Host Dashboard

The host's control center. Reached by clicking their own stream from the homepage.

#### State: Scheduled (OBS not yet connected)

```
┌─── Host Dashboard ───────────────────────────────────────┐
│                                                           │
│  ← Back to Home                                          │
│                                                           │
│  "Monday Grammar Lecture"                                │
│  Scheduled for Mar 10, 3:00 PM                           │
│  Status: ● Scheduled                                     │
│                                                           │
│  ┌─── OBS Setup ─────────────────────────────────────┐   │
│  │                                                     │   │
│  │  RTMP Server                                        │   │
│  │  ┌─────────────────────────────────┐  [Copy]       │   │
│  │  │ rtmps://global-live.mux.com/app │               │   │
│  │  └─────────────────────────────────┘               │   │
│  │                                                     │   │
│  │  Stream Key                                         │   │
│  │  ┌─────────────────────────────────┐  [Copy]       │   │
│  │  │ ●●●●●●●●●●●●●●●●  [Show]       │               │   │
│  │  └─────────────────────────────────┘               │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─── How to connect OBS (collapsed) ────────────────┐   │
│  │  ▶ Click to expand setup guide                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
│  ⏳ Waiting for OBS connection...                        │
│     Connect OBS and click "Start Streaming" to preview   │
│                                                           │
│  ┌─── Danger Zone ───────────────────────────────────┐   │
│  │  [Delete Stream]  [Reset Stream Key]               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Notes:**
- Mux live stream is created lazily on first dashboard open
- Stream key is masked by default with a [Show] toggle
- OBS setup guide is collapsible — expanded by default on first visit, collapsed on return visits (localStorage flag)
- Polls stream status every 5 seconds to detect OBS connection

#### OBS Setup Guide (expanded)

```
┌─── How to connect OBS ───────────────────────────────┐
│                                                        │
│  1. Download OBS Studio (if needed)                    │
│     → obsproject.com/download                          │
│                                                        │
│  2. Open OBS → Settings → Stream                       │
│     • Set Service to "Custom..."                       │
│     • Paste the Server URL above                       │
│     • Paste the Stream Key above                       │
│     • Click OK                                         │
│                                                        │
│  3. Set up your scene                                  │
│     • Add a Video Capture source for your camera       │
│     • Add a Display/Window Capture for slides          │
│     • Arrange as desired in the preview                │
│                                                        │
│  4. Click "Start Streaming" in OBS                     │
│     This page will detect your connection              │
│     automatically.                                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### State: Preview (OBS connected, not yet live to viewers)

```
┌─── Host Dashboard ───────────────────────────────────────┐
│                                                           │
│  "Monday Grammar Lecture"                                │
│  Status: ● Preview (only you can see this)               │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │                                                   │     │
│  │            [ Live Preview Video Feed ]            │     │
│  │              (Mux player embed)                   │     │
│  │                                                   │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ✓ OBS connected · Video feed looks good                 │
│                                                           │
│  ┌─────────────────────────────────────────────┐         │
│  │         [  🔴  Go Live  ]                    │         │
│  │  This will make your stream visible to       │         │
│  │  everyone on the homepage.                   │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  [End Without Streaming]                                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

#### State: Live

```
┌─── Host Dashboard ───────────────────────────────────────┐
│                                                           │
│  "Monday Grammar Lecture"          🔴 LIVE · 23:45       │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │                                                   │     │
│  │            [ Live Preview Video Feed ]            │     │
│  │                                                   │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  Viewers: 24                                              │
│                                                           │
│  [End Stream]                                             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Behavior:**
- Duration timer counts from the moment "Go Live" was clicked
- Viewer count polled from Mux or tracked via your own mechanism
- "End Stream" shows confirmation modal before proceeding

#### End Stream Confirmation

```
┌─── End Stream? ──────────────────────────────┐
│                                                │
│  This will end the stream for all 24 viewers.  │
│  A recording will be saved automatically.      │
│                                                │
│           [Cancel]   [End Stream]               │
│                                                │
└────────────────────────────────────────────────┘
```

---

### 4. Viewer Page

#### State: Upcoming (countdown)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                                                  │
│                                                          │
│  "Monday Grammar Lecture"                                │
│  Covering past tense and irregular verbs                 │
│                                                          │
│              Starts in                                    │
│           2d  04h  32m  15s                               │
│                                                          │
│  Scheduled for Mar 10, 3:00 PM                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Polls stream status every 15 seconds
- Auto-transitions to player when status becomes `live`

#### State: Live

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                        🔴 LIVE                   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │                                                     │  │
│  │              [ Mux Video Player ]                   │  │
│  │                                                     │  │
│  │                                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  "Monday Grammar Lecture"                                │
│  Captions: [EN]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### State: Ended (VOD available)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                                                  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │              [ Mux VOD Player ]                     │  │
│  │                                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  "Monday Grammar Lecture"                                │
│  Recorded Mar 10, 2026 · 1h 23m                         │
│  Captions: [EN]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### State: Ended (VOD not yet ready)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                                                  │
│                                                          │
│  "Monday Grammar Lecture"                                │
│  Stream ended                                            │
│                                                          │
│  ⏳ Recording is being processed...                     │
│     This usually takes a few minutes.                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Stream Events (new, in mux-worker or a new streams-worker)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/streams` | Schedule a new stream (title, description, scheduled_at) |
| `GET` | `/api/streams` | List streams, filterable by status |
| `GET` | `/api/streams/:id` | Get stream details |
| `PUT` | `/api/streams/:id/provision` | Lazily create Mux live stream + store IDs |
| `PUT` | `/api/streams/:id/go-live` | Transition from preview → live |
| `PUT` | `/api/streams/:id/end` | End the stream, trigger Mux complete |
| `DELETE` | `/api/streams/:id` | Delete a scheduled stream |

### Mux Webhook Events to Handle

| Event | Action |
|---|---|
| `video.live_stream.active` | If status is `scheduled`, set to `preview` |
| `video.live_stream.idle` | If status is `preview` and brief disconnect, keep `preview`; if prolonged, may flag |
| `video.asset.ready` | Store `mux_asset_id` for VOD playback |

---

## Implementation Phases

### Phase 1: Data Layer
- Add D1 database binding to mux-worker (or create streams-worker)
- Create `streams` table schema
- Implement CRUD API endpoints for stream events
- Update Mux webhook handler for new status transitions

### Phase 2: Homepage Integration
- Refactor homepage to fetch and display streams in three sections (live, upcoming, past)
- Add `[+ Schedule New Stream]` button with role-based visibility
- Build the schedule modal component

### Phase 3: Host Dashboard
- Build the host dashboard with all four states (scheduled, preview, live, ended)
- Implement lazy Mux stream provisioning on dashboard open
- Add OBS setup guide (collapsible)
- Wire up Go Live and End Stream actions

### Phase 4: Viewer Experience
- Build countdown page for upcoming streams
- Auto-transition from countdown to live player
- Handle stream-ended state with VOD fallback
- Add caption toggle

### Phase 5: Polish
- Add stream duration timer and viewer count
- End stream confirmation modal
- Stream key show/hide toggle
- localStorage for "has seen OBS guide" flag
- Error states and reconnection handling
