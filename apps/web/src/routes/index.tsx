import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { listPublicStreams } from "~/lib/video-client";
import { StreamCard } from "~/components/stream/StreamCard";
import type { PublicStreamListing } from "@web-template/shared";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: session } = authClient.useSession();
  const [listing, setListing] = useState<PublicStreamListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicStreams()
      .then(setListing)
      .catch(() => setListing({ live: [], upcoming: [], past: [] }))
      .finally(() => setLoading(false));
  }, []);

  const role = session?.user?.role as string | undefined;
  const canAccessDashboard = role === "host" || role === "admin";
  const isEmpty =
    listing &&
    listing.live.length === 0 &&
    listing.upcoming.length === 0 &&
    listing.past.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Woai
          </Link>
          <div className="flex items-center gap-3">
            {canAccessDashboard && (
              <Link
                to="/dashboard"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Dashboard
              </Link>
            )}
            {session ? (
              <span className="text-sm text-gray-500">{session.user.name}</span>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500">Loading streams...</p>
          </div>
        )}

        {!loading && isEmpty && (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500">No streams yet — check back soon</p>
          </div>
        )}

        {listing && listing.live.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Currently Streaming
            </h2>
            <div className="space-y-3">
              {listing.live.map((s) => (
                <StreamCard key={s.id} stream={s} />
              ))}
            </div>
          </section>
        )}

        {listing && listing.upcoming.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upcoming Streams
            </h2>
            <div className="space-y-3">
              {listing.upcoming.map((s) => (
                <StreamCard key={s.id} stream={s} />
              ))}
            </div>
          </section>
        )}

        {listing && listing.past.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Past Streams
            </h2>
            <div className="space-y-3">
              {listing.past.map((s) => (
                <StreamCard key={s.id} stream={s} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
