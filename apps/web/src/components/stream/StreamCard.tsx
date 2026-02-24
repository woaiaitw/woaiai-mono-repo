import { Link } from "@tanstack/react-router";
import type { Stream } from "@web-template/shared";
import { StatusBadge } from "./StatusBadge";

interface StreamCardProps {
  stream: Stream;
  /** If true, links to dashboard detail page instead of public event page */
  dashboard?: boolean;
}

export function StreamCard({ stream, dashboard }: StreamCardProps) {
  const scheduledDate = new Date(stream.scheduledAt);
  const isLive = stream.status === "live" || stream.status === "paused";
  const isUpcoming = stream.status === "scheduled" || stream.status === "pre_stream";
  const isCompleted = stream.status === "completed";

  const linkProps = dashboard
    ? { to: "/dashboard/streams/$id" as const, params: { id: stream.id } }
    : { to: "/event/$slug" as const, params: { slug: stream.slug } };

  return (
    <Link
      {...linkProps}
      className="block bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1 mr-3">
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {stream.title}
          </h2>
          {stream.description && (
            <p className="text-sm text-gray-500 line-clamp-1">
              {stream.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-400">
            {stream.hostName && (
              <span>{stream.hostName}</span>
            )}
            <span>
              {scheduledDate.toLocaleDateString()} at{" "}
              {scheduledDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {dashboard && (
            <p className="text-xs text-gray-400 font-mono">/event/{stream.slug}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={stream.status} />
          {!dashboard && (
            <span className="text-xs font-medium text-gray-500">
              {isLive && "Watch Now"}
              {isUpcoming &&
                scheduledDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              {isCompleted && "Watch Replay"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
