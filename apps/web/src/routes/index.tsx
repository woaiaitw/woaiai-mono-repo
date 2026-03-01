import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_LANGUAGE } from "@web-template/shared";
import type { StreamingEvent } from "@web-template/shared";
import { LanguageSelect } from "../components/LanguageSelect";

const AUTH_URL =
  import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [events, setEvents] = useState<StreamingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    fetch(`${AUTH_URL}/api/events`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: { events: StreamingEvent[] }) => setEvents(data.events))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const upcomingEvents = events.filter(
    (e) => e.status === "upcoming" || e.status === "live"
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-8">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Live Broadcast</h1>
          <p className="text-lg text-gray-400">
            Real-time video with live transcription
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <div className="flex gap-2 items-center">
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              className="px-4 py-4 bg-gray-800 text-white text-lg font-semibold rounded-xl border border-gray-600 hover:bg-gray-700 transition-colors"
            />
            <Link
              to="/meeting"
              search={{ role: "host", lang: language }}
              className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Start as Host
            </Link>
          </div>
          <Link
            to="/meeting"
            search={{ role: "viewer", lang: DEFAULT_LANGUAGE }}
            className="inline-block px-8 py-4 border border-gray-600 text-gray-200 text-lg font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Join as Viewer
          </Link>
        </div>
      </div>

      {!eventsLoading && upcomingEvents.length > 0 && (
        <div className="mt-12 w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Upcoming Events
            </h2>
            <Link
              to="/events"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all events
            </Link>
          </div>
          <div className="grid gap-3">
            {upcomingEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white">{event.title}</h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                      event.status === "live"
                        ? "bg-green-900/50 text-green-300 border-green-700"
                        : "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
                {event.description && (
                  <p className="text-gray-400 text-sm">{event.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(event.scheduledAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!eventsLoading && (
        <div className="mt-6">
          <Link
            to="/events"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Browse all events
          </Link>
        </div>
      )}
    </div>
  );
}
