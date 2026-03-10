import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsHost } from "~/hooks/useIsHost";
import { useEventPolling } from "~/hooks/useEventPolling";
import { StatusBadge } from "~/components/StatusBadge";
import { CountdownTimer } from "~/components/CountdownTimer";
import { StreamPlayer } from "~/components/StreamPlayer";
import { HostStreamControls } from "~/components/HostStreamControls";
import { EventBanner } from "~/components/EventBanner";

export const Route = createFileRoute("/event/$id")({
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { isHost, isLoading: hostLoading } = useIsHost();
  const { event, hostEvent, error, isLoading, refetch } = useEventPolling({
    id,
    isHost,
  });

  if (isLoading || hostLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-800 rounded" />
          <div className="h-4 w-96 bg-gray-800 rounded" />
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-red-400 text-lg">{error ?? "Event not found"}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to events
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        to="/"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        &larr; Back to events
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
          <StatusBadge status={event.status} />
        </div>
        {event.description && (
          <p className="text-gray-400">{event.description}</p>
        )}
      </div>

      {/* Status-based content */}
      {event.status === "scheduled" && (
        <EventBanner
          targetDate={event.scheduled_at}
          className="aspect-video"
        />
      )}

      {event.status === "preview" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-300">The stream is almost ready...</p>
        </div>
      )}

      {event.status === "live" && event.mux_playback_id && (
        <StreamPlayer playbackId={event.mux_playback_id} />
      )}

      {event.status === "ended" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">This event has ended</p>
        </div>
      )}

      {/* Host controls */}
      {isHost && hostEvent && event.status !== "ended" && (
        <HostStreamControls event={hostEvent} onUpdate={refetch} />
      )}
    </main>
  );
}
