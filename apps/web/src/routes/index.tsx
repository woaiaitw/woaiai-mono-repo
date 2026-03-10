import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { StreamEvent } from "@web-template/shared";
import { listEvents } from "~/lib/mux-client";
import { useIsHost } from "~/hooks/useIsHost";
import { EventCard } from "~/components/EventCard";
import { CreateEventForm } from "~/components/CreateEventForm";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function groupEvents(events: StreamEvent[]) {
  const streaming: StreamEvent[] = [];
  const upcoming: StreamEvent[] = [];
  const past: StreamEvent[] = [];

  for (const event of events) {
    if (event.status === "live" || event.status === "preview") {
      streaming.push(event);
    } else if (event.status === "scheduled") {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }

  // Sort upcoming by scheduled time ascending (soonest first)
  upcoming.sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  // Sort past by scheduled time descending (most recent first)
  past.sort(
    (a, b) =>
      new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  );

  return { streaming, upcoming, past };
}

function EventSection({
  title,
  events,
}: {
  title: string;
  events: StreamEvent[];
}) {
  if (events.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-300">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function HomePage() {
  const { isHost } = useIsHost();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = async () => {
    try {
      const data = await listEvents();
      setEvents(data);
    } catch {
      // silent — empty state shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const { streaming, upcoming, past } = groupEvents(events);
  const hasEvents = events.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Events</h1>
          <p className="mt-1 text-gray-400">Browse upcoming and live events</p>
        </div>
        {isHost && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Event
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-900 border border-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : !hasEvents ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No events yet</p>
          {isHost && (
            <p className="mt-2 text-gray-600 text-sm">
              Create your first event to get started
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <EventSection title="Currently Streaming" events={streaming} />
          <EventSection title="Upcoming Streams" events={upcoming} />
          <EventSection title="Past Streams" events={past} />
        </div>
      )}

      {showCreate && (
        <CreateEventForm
          onCreated={() => {
            setShowCreate(false);
            fetchEvents();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </main>
  );
}
