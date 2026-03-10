import type { StreamEventStatus } from "@web-template/shared";

const STATUS_CONFIG: Record<
  StreamEventStatus,
  { label: string; classes: string }
> = {
  scheduled: {
    label: "Scheduled",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  preview: {
    label: "Starting",
    classes: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  live: {
    label: "Live",
    classes: "bg-green-50 text-green-700 border-green-200",
  },
  ended: {
    label: "Ended",
    classes: "bg-gray-100 text-gray-600 border-gray-200",
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}
