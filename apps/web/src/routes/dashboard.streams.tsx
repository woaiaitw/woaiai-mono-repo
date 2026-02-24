import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { listStreams } from "~/lib/video-client";
import { StreamCard } from "~/components/stream/StreamCard";
import type { Stream } from "@web-template/shared";

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
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20">
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
    <div className="space-y-6">
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
          <p className="text-gray-500 mb-4">No streams yet. Create your first stream.</p>
          <Link
            to="/dashboard/streams/new"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Stream
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {streams.map((stream) => (
          <StreamCard key={stream.id} stream={stream} dashboard />
        ))}
      </div>
    </div>
  );
}
