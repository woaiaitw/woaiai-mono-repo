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
      className="block bg-card border border-edge rounded-xl overflow-hidden hover:border-edge-hover transition-colors"
    >
      <EventBannerCompact />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-heading truncate">
            {event.title}
          </h3>
          <StatusBadge status={event.status} />
        </div>
        {event.description && (
          <p className="mt-2 text-sm text-subtle line-clamp-2">
            {event.description}
          </p>
        )}
        <p className="mt-3 text-xs text-faint">
          {formatDate(event.scheduled_at)}
        </p>
      </div>
    </Link>
  );
}
