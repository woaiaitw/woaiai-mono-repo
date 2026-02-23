import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { listStreams } from "~/lib/video-client";
import type { Stream, StreamStatus } from "@web-template/shared";

export const Route = createFileRoute("/dashboard/streams")({
  component: StreamsListPage,
});

function StreamsListPage() {
  const { data: session, isPending } = authClient.useSession();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    listStreams()
      .then((data) => {
        setStreams(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load streams");
        setLoading(false);
      });
  }, [session]);

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">Sign in to manage streams.</p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Live Streams</h1>
          <Link
            to="/dashboard/streams/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Stream
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {streams.length === 0 && !error && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">No streams yet. Create your first stream.</p>
          </div>
        )}

        <div className="space-y-3">
          {streams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StreamCard({ stream }: { stream: Stream }) {
  const scheduledDate = new Date(stream.scheduledAt);

  return (
    <Link
      to="/dashboard/streams/$id"
      params={{ id: stream.id }}
      className="block bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">{stream.title}</h2>
          {stream.description && (
            <p className="text-sm text-gray-500 line-clamp-1">{stream.description}</p>
          )}
          <p className="text-sm text-gray-400">
            {scheduledDate.toLocaleDateString()} at{" "}
            {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-gray-400 font-mono">/event/{stream.slug}</p>
        </div>
        <StatusBadge status={stream.status} />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: StreamStatus }) {
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

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
