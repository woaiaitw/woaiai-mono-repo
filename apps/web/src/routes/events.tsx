import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { useState, useEffect, useCallback } from "react";
import type { StreamingEvent } from "@web-template/shared";

const AUTH_URL =
  import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventsPage() {
  const { data: session, isPending: sessionPending } =
    authClient.useSession();

  const [events, setEvents] = useState<StreamingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdminOrOwner =
    session?.user?.role === "owner" || session?.user?.role === "admin";

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AUTH_URL}/api/events`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { events: StreamingEvent[] };
      setEvents(data.events);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Streaming Events</h1>
          <div className="flex items-center gap-3">
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showCreateForm ? "Cancel" : "New Event"}
              </button>
            )}
            <Link
              to="/"
              className="px-4 py-2 text-sm text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {showCreateForm && isAdminOrOwner && (
          <CreateEventForm
            onCreated={() => {
              setShowCreateForm(false);
              fetchEvents();
            }}
            onError={setError}
          />
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No streaming events yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEventForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (error: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    onError("");

    try {
      const res = await fetch(`${AUTH_URL}/api/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setTitle("");
      setDescription("");
      setScheduledAt("");
      onCreated();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to create event"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-white">
        Create New Streaming Event
      </h2>

      <div>
        <label
          htmlFor="event-title"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Title
        </label>
        <input
          id="event-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Event title"
        />
      </div>

      <div>
        <label
          htmlFor="event-description"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Description
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Event description (optional)"
        />
      </div>

      <div>
        <label
          htmlFor="event-date"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Scheduled Date & Time
        </label>
        <input
          id="event-date"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Event"}
      </button>
    </form>
  );
}

function EventCard({ event }: { event: StreamingEvent }) {
  const statusColors: Record<string, string> = {
    upcoming: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
    live: "bg-green-900/50 text-green-300 border-green-700",
    ended: "bg-gray-800 text-gray-400 border-gray-600",
  };

  const statusStyle =
    statusColors[event.status] ??
    "bg-gray-800 text-gray-400 border-gray-600";

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-3">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-white">{event.title}</h3>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full border ${statusStyle}`}
        >
          {event.status}
        </span>
      </div>
      {event.description && (
        <p className="text-gray-400 text-sm">{event.description}</p>
      )}
      <div className="text-xs text-gray-500">
        Scheduled: {new Date(event.scheduledAt).toLocaleString()}
      </div>
    </div>
  );
}
