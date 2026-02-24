import type { StreamStatus } from "@web-template/shared";

const styles: Record<StreamStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  pre_stream: "bg-yellow-100 text-yellow-700",
  live: "bg-red-100 text-red-700",
  paused: "bg-yellow-100 text-yellow-700",
  ending: "bg-orange-100 text-orange-700",
  processing: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: StreamStatus }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
