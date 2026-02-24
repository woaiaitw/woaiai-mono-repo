import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { getStream, getRecordings, getRecordingUrl } from "~/lib/video-client";
import type { Stream, Recording } from "@web-template/shared";

export const Route = createFileRoute("/dashboard/streams/$id/recordings")({
  component: RecordingsPage,
});

function RecordingsPage() {
  const { id } = Route.useParams();
  const { data: session } = authClient.useSession();
  const [stream, setStream] = useState<Stream | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;

    Promise.all([getStream(id), getRecordings(id)])
      .then(([streamData, recordingData]) => {
        setStream(streamData);
        setRecordings(recordingData as Recording[]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });
  }, [id, session]);

  const handleDownload = async () => {
    try {
      const { downloadUrl } = await getRecordingUrl(id);
      window.open(downloadUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get download URL");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/dashboard/streams" className="hover:text-blue-600">
            Streams
          </Link>
          <span>/</span>
          {stream && (
            <>
              <Link
                to="/dashboard/streams/$id"
                params={{ id }}
                className="hover:text-blue-600"
              >
                {stream.title}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900">Recordings</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Recordings</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {recordings.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">
              {stream?.status === "processing"
                ? "Recording is being processed. Check back in a few minutes."
                : "No recordings available for this stream."}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="bg-white rounded-xl shadow-sm p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      Recording
                    </span>
                    <RecordingStatusBadge status={recording.status} />
                  </div>
                  {recording.startedAt && (
                    <p className="text-xs text-gray-500">
                      Started: {new Date(recording.startedAt).toLocaleString()}
                    </p>
                  )}
                  {recording.duration && (
                    <p className="text-xs text-gray-500">
                      Duration: {Math.floor(recording.duration / 60)}m{" "}
                      {recording.duration % 60}s
                    </p>
                  )}
                  {recording.fileSize && (
                    <p className="text-xs text-gray-500">
                      Size: {(recording.fileSize / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                </div>

                {recording.status === "ready" && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}

function RecordingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    recording: "bg-red-100 text-red-700",
    processing: "bg-yellow-100 text-yellow-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
