import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  getEvent,
  getEventHost,
  listEvents,
  provisionEvent,
  goLive,
  endEvent,
  deleteEvent,
  scheduleEvent,
} from "../lib/mux-client";
import { authClient } from "../lib/auth-client";
import type { StreamEvent, StreamEventHost } from "@web-template/shared";

export const Route = createFileRoute("/stream")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: (search.role as "host" | "viewer") || "viewer",
    eventId: (search.eventId as string) || "",
    playbackId: (search.playbackId as string) || "",
    streamId: (search.streamId as string) || "",
  }),
  component: StreamPage,
});

function StreamPage() {
  const { role, eventId, playbackId } = Route.useSearch();
  const navigate = useNavigate();

  if (role === "host") {
    return <HostDashboard initialEventId={eventId} />;
  }

  return (
    <ViewerPanel
      eventId={eventId}
      playbackId={playbackId}
      onBack={() => navigate({ to: "/" })}
    />
  );
}

// ─── Host Dashboard ─────────────────────────────────────────

function HostDashboard({ initialEventId }: { initialEventId: string }) {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<StreamEventHost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"key" | "url" | null>(null);

  // Schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const isHost =
    session?.user?.role === "owner" || session?.user?.role === "admin";

  const loadEvents = useCallback(async () => {
    try {
      const list = await listEvents();
      setEvents(list);
    } catch {
      // ignore
    }
  }, []);

  const loadEvent = useCallback(async (id: string) => {
    try {
      const ev = await getEventHost(id);
      setSelectedEvent(ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load event");
    }
  }, []);

  useEffect(() => {
    loadEvents().then(() => setLoading(false));
  }, [loadEvents]);

  // Auto-select event if ID provided
  useEffect(() => {
    if (initialEventId && isHost) {
      loadEvent(initialEventId);
    }
  }, [initialEventId, isHost, loadEvent]);

  // Poll selected event every 5s
  useEffect(() => {
    if (!selectedEvent) return;
    const interval = setInterval(() => loadEvent(selectedEvent.id), 5000);
    return () => clearInterval(interval);
  }, [selectedEvent, loadEvent]);

  if (!isHost) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-lg">
            Only owners and admins can access the host dashboard.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-blue-400 hover:text-blue-300"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const handleSchedule = async () => {
    if (!title || !scheduledAt) return;
    setError("");
    try {
      await scheduleEvent({ title, description, scheduled_at: scheduledAt });
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setShowSchedule(false);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    }
  };

  const handleProvision = async () => {
    if (!selectedEvent) return;
    setError("");
    try {
      const updated = await provisionEvent(selectedEvent.id);
      setSelectedEvent(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to provision");
    }
  };

  const handleGoLive = async () => {
    if (!selectedEvent) return;
    setError("");
    try {
      await goLive(selectedEvent.id);
      await loadEvent(selectedEvent.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to go live");
    }
  };

  const handleEnd = async () => {
    if (!selectedEvent) return;
    setError("");
    try {
      await endEvent(selectedEvent.id);
      await loadEvent(selectedEvent.id);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end stream");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteEvent(id);
      if (selectedEvent?.id === id) setSelectedEvent(null);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const copyToClipboard = async (text: string, type: "key" | "url") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Stream Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="px-4 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              Schedule Stream
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Schedule Form */}
        {showSchedule && (
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Schedule a Stream</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Stream title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500"
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none"
                rows={2}
              />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSchedule}
                  disabled={!title || !scheduledAt}
                  className="px-4 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  Schedule
                </button>
                <button
                  onClick={() => setShowSchedule(false)}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No streams scheduled. Create one to get started.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => loadEvent(ev.id)}
                className={`bg-gray-900 rounded-xl p-4 cursor-pointer hover:bg-gray-800/80 transition-colors flex items-center justify-between ${
                  selectedEvent?.id === ev.id ? "ring-1 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <StatusBadge status={ev.status} />
                  <div>
                    <p className="font-semibold">{ev.title}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(ev.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {(ev.status === "scheduled" || ev.status === "ended") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ev.id);
                    }}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Selected Event Detail */}
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
                {selectedEvent.description && (
                  <p className="text-gray-400 mt-1">{selectedEvent.description}</p>
                )}
              </div>
              <StatusBadge status={selectedEvent.status} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {selectedEvent.status === "scheduled" && !selectedEvent.mux_stream_id && (
                <button
                  onClick={handleProvision}
                  className="px-4 py-2 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm"
                >
                  Provision Stream
                </button>
              )}
              {selectedEvent.status === "preview" && (
                <button
                  onClick={handleGoLive}
                  className="px-4 py-2 bg-green-600 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
                >
                  Go Live
                </button>
              )}
              {(selectedEvent.status === "live" || selectedEvent.status === "preview") && (
                <button
                  onClick={handleEnd}
                  className="px-4 py-2 bg-red-600 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                >
                  End Stream
                </button>
              )}
            </div>

            {/* OBS Configuration (when provisioned) */}
            {selectedEvent.mux_stream_key && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-4">
                <h3 className="text-xl font-semibold">OBS Configuration</h3>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">RTMP Server</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono">
                      {selectedEvent.rtmpUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedEvent.rtmpUrl, "url")}
                      className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                    >
                      {copied === "url" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Stream Key</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono truncate">
                      {selectedEvent.mux_stream_key}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedEvent.mux_stream_key || "", "key")
                      }
                      className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                    >
                      {copied === "key" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Viewer Link */}
            {selectedEvent.mux_playback_id && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-2">
                <h3 className="text-xl font-semibold">Viewer Link</h3>
                <p className="text-sm text-gray-400">Share this with your audience:</p>
                <code className="block bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono break-all">
                  {window.location.origin}/stream?eventId={selectedEvent.id}
                </code>
              </div>
            )}

            {/* Live Preview */}
            {selectedEvent.status === "live" && selectedEvent.mux_playback_id && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-2">
                <h3 className="text-xl font-semibold">Live Preview</h3>
                <MuxPlayerEmbed playbackId={selectedEvent.mux_playback_id} />
              </div>
            )}

            {/* Quick Start Instructions */}
            {selectedEvent.mux_stream_key && selectedEvent.status !== "ended" && (
              <div className="bg-gray-900/50 rounded-xl p-6 space-y-2 text-sm text-gray-400">
                <h3 className="text-white font-semibold">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open OBS Studio &rarr; Settings &rarr; Stream</li>
                  <li>Set Service to "Custom"</li>
                  <li>Paste the RTMP Server and Stream Key above</li>
                  <li>Click "Start Streaming" in OBS</li>
                  <li>Status will change to "Preview" once OBS connects</li>
                  <li>Click "Go Live" when ready for viewers</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Viewer Panel ────────────────────────────────────────────

function ViewerPanel({
  eventId,
  playbackId: initialPlaybackId,
  onBack,
}: {
  eventId: string;
  playbackId: string;
  onBack: () => void;
}) {
  const [event, setEvent] = useState<StreamEvent | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [playbackId, setPlaybackId] = useState(initialPlaybackId);

  useEffect(() => {
    if (!eventId) {
      setStatus(initialPlaybackId ? "ready" : "no-stream");
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const ev = await getEvent(eventId);
        if (cancelled) return;
        setEvent(ev);
        setStatus(ev.status);
        if (ev.mux_playback_id) setPlaybackId(ev.mux_playback_id);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId, initialPlaybackId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            {event?.title || "Live Stream"}
          </h1>
          <StatusBadge status={status} />
        </div>
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {status === "scheduled" ? (
          <div className="text-center space-y-3">
            <p className="text-gray-400 text-lg">Stream starts at</p>
            <p className="text-2xl font-bold">
              {event ? new Date(event.scheduled_at).toLocaleString() : "..."}
            </p>
          </div>
        ) : status === "preview" ? (
          <div className="text-center space-y-2">
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-lg">
              Host is getting ready... stream will begin shortly.
            </p>
          </div>
        ) : status === "live" && playbackId ? (
          <div className="w-full max-w-5xl">
            <MuxPlayerEmbed playbackId={playbackId} />
          </div>
        ) : status === "ended" ? (
          <p className="text-gray-500 text-lg">This stream has ended.</p>
        ) : !playbackId ? (
          <p className="text-gray-500 text-lg">
            No stream available. Ask the host for a viewer link.
          </p>
        ) : (
          <div className="w-full max-w-5xl">
            <MuxPlayerEmbed playbackId={playbackId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    preview: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    live: "bg-green-500/20 text-green-400 border-green-500/30",
    ended: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    idle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    disabled: "bg-red-500/20 text-red-400 border-red-500/30",
    loading: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    preview: "Preview",
    live: "Live",
    ended: "Ended",
    active: "Live",
    idle: "Idle",
    disabled: "Disabled",
    loading: "Loading...",
    error: "Error",
    ready: "Ready",
    "no-stream": "No Stream",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.loading}`}
    >
      {labels[status] || status}
    </span>
  );
}

function MuxPlayerEmbed({ playbackId }: { playbackId: string }) {
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <iframe
        src={`https://player.mux.com/${playbackId}`}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
