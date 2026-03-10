import type { StreamEventStatus } from "@web-template/shared";

const STATUS_CONFIG: Record<
  StreamEventStatus,
  { label: string; classes: string }
> = {
  scheduled: {
    label: "Scheduled",
    classes: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  preview: {
    label: "Starting",
    classes: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  live: {
    label: "Live",
    classes: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  ended: {
    label: "Ended",
    classes: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  },
};

export function StatusBadge({ status }: { status: StreamEventStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${config.classes}`}
    >
      {status === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
      )}
      {config.label}
    </span>
  );
}
