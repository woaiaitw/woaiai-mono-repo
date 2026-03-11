import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, memo } from "react";
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
import { EventBanner } from "../components/EventBanner";

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

  // Poll selected event every 5s (depend on ID only to avoid re-render cascades)
  const selectedEventId = selectedEvent?.id;
  useEffect(() => {
    if (!selectedEventId) return;
    const interval = setInterval(() => loadEvent(selectedEventId), 5000);
    return () => clearInterval(interval);
  }, [selectedEventId, loadEvent]);

  if (!isHost) {
    return (
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-subtle text-lg">
            Only owners and admins can access the host dashboard.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-blue-600 hover:text-blue-700"
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
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <p className="text-subtle">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-heading p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Stream Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              Schedule Stream
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-subtle hover:text-heading transition-colors"
            >
              Back
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Schedule Form */}
        {showSchedule && (
          <div className="bg-card border border-edge rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Schedule a Stream</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Stream title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-input rounded-lg px-4 py-2 text-heading placeholder-faint"
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-input rounded-lg px-4 py-2 text-heading placeholder-faint resize-none"
                rows={2}
              />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-input rounded-lg px-4 py-2 text-heading"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSchedule}
                  disabled={!title || !scheduledAt}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  Schedule
                </button>
                <button
                  onClick={() => setShowSchedule(false)}
                  className="px-4 py-2 bg-input rounded-lg hover:bg-card-hover transition-colors text-sm"
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
            <p className="text-faint text-center py-8">
              No streams scheduled. Create one to get started.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => loadEvent(ev.id)}
                className={`bg-card border border-edge rounded-xl p-4 cursor-pointer hover:bg-card-hover transition-colors flex items-center justify-between ${
                  selectedEvent?.id === ev.id ? "ring-1 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <StatusBadge status={ev.status} />
                  <div>
                    <p className="font-semibold">{ev.title}</p>
                    <p className="text-sm text-subtle">
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
                    className="text-faint hover:text-red-600 transition-colors text-sm"
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
                  <p className="text-subtle mt-1">{selectedEvent.description}</p>
                )}
              </div>
              <StatusBadge status={selectedEvent.status} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {selectedEvent.status === "scheduled" && !selectedEvent.mux_stream_id && (
                <button
                  onClick={handleProvision}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm"
                >
                  Provision Stream
                </button>
              )}
              {(selectedEvent.status === "preview" ||
                (selectedEvent.status === "scheduled" && selectedEvent.mux_stream_id)) && (
                <button
                  onClick={handleGoLive}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
                >
                  Go Live
                </button>
              )}
              {(selectedEvent.status === "live" || selectedEvent.status === "preview") && (
                <button
                  onClick={handleEnd}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                >
                  End Stream
                </button>
              )}
            </div>

            {/* OBS Configuration (when provisioned) */}
            {selectedEvent.mux_stream_key && (
              <div className="bg-card border border-edge rounded-xl p-6 space-y-4">
                <h3 className="text-xl font-semibold">OBS Configuration</h3>
                <div className="space-y-2">
                  <label className="text-sm text-subtle">RTMP Server</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-input px-4 py-2 rounded-lg text-sm font-mono">
                      {selectedEvent.rtmpUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedEvent.rtmpUrl, "url")}
                      className="px-3 py-2 bg-input rounded-lg hover:bg-card-hover text-sm"
                    >
                      {copied === "url" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-subtle">Stream Key</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-input px-4 py-2 rounded-lg text-sm font-mono truncate">
                      {selectedEvent.mux_stream_key}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedEvent.mux_stream_key || "", "key")
                      }
                      className="px-3 py-2 bg-input rounded-lg hover:bg-card-hover text-sm"
                    >
                      {copied === "key" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Viewer Link */}
            {selectedEvent.mux_playback_id && (
              <div className="bg-card border border-edge rounded-xl p-6 space-y-2">
                <h3 className="text-xl font-semibold">Viewer Link</h3>
                <p className="text-sm text-subtle">Share this with your audience:</p>
                <code className="block bg-input px-4 py-2 rounded-lg text-sm font-mono break-all">
                  {window.location.origin}/stream?eventId={selectedEvent.id}
                </code>
              </div>
            )}

            {/* Live Preview */}
            {(selectedEvent.status === "live" || selectedEvent.status === "preview") && selectedEvent.mux_playback_id && (
              <div className="bg-card border border-edge rounded-xl p-6 space-y-2">
                <h3 className="text-xl font-semibold">Live Preview</h3>
                <MuxPlayerEmbed playbackId={selectedEvent.mux_playback_id} />
              </div>
            )}

            {/* Quick Start Instructions */}
            {selectedEvent.mux_stream_key && selectedEvent.status !== "ended" && (
              <div className="bg-card-hover rounded-xl p-6 space-y-2 text-sm text-subtle">
                <h3 className="text-heading font-semibold">Quick Start</h3>
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
        // Only update event state when display fields change to avoid re-render cascades
        setEvent((prev) =>
          prev && prev.title === ev.title && prev.status === ev.status && prev.scheduled_at === ev.scheduled_at
            ? prev
            : ev
        );
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
    <div className="min-h-screen bg-page text-heading flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-edge">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            {event?.title || "Live Stream"}
          </h1>
          <StatusBadge status={status} />
        </div>
        <button
          onClick={onBack}
          className="text-subtle hover:text-heading transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {status === "scheduled" && event ? (
          <div className="w-full max-w-5xl">
            <EventBanner
              targetDate={event.scheduled_at}
              className="aspect-video"
            />
          </div>
        ) : status === "preview" ? (
          <div className="text-center space-y-2">
            <div className="w-16 h-16 border-4 border-edge border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-subtle text-lg">
              Host is getting ready... stream will begin shortly.
            </p>
          </div>
        ) : status === "live" && playbackId ? (
          <div className="w-full max-w-5xl">
            <MuxPlayerEmbed playbackId={playbackId} />
          </div>
        ) : status === "ended" ? (
          <p className="text-faint text-lg">This stream has ended.</p>
        ) : !playbackId ? (
          <p className="text-faint text-lg">
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
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    preview: "bg-yellow-50 text-yellow-700 border-yellow-200",
    live: "bg-green-50 text-green-700 border-green-200",
    ended: "bg-gray-100 text-gray-600 border-gray-200",
    active: "bg-green-50 text-green-700 border-green-200",
    idle: "bg-yellow-50 text-yellow-700 border-yellow-200",
    disabled: "bg-red-50 text-red-700 border-red-200",
    loading: "bg-gray-100 text-gray-600 border-gray-200",
    error: "bg-red-50 text-red-700 border-red-200",
    ready: "bg-blue-50 text-blue-700 border-blue-200",
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

const MuxPlayerEmbed = memo(function MuxPlayerEmbed({ playbackId }: { playbackId: string }) {
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
});
