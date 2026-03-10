import { Link } from "@tanstack/react-router";
import type { StreamEvent } from "@web-template/shared";
import { StatusBadge } from "./StatusBadge";
import { EventBannerCompact } from "./EventBanner";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventCard({ event }: { event: StreamEvent }) {
  return (
    <Link
      to="/event/$id"
      params={{ id: event.id }}
      className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
    >
      <EventBannerCompact />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-white truncate">
            {event.title}
          </h3>
          <StatusBadge status={event.status} />
        </div>
        {event.description && (
          <p className="mt-2 text-sm text-gray-400 line-clamp-2">
            {event.description}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          {formatDate(event.scheduled_at)}
        </p>
      </div>
    </Link>
  );
}
