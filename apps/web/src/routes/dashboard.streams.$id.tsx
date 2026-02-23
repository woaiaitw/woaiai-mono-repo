import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import {
  getStream,
  updateStream,
  deleteStream,
  publishStream,
} from "~/lib/video-client";
import type { Stream, StreamStatus } from "@web-template/shared";

export const Route = createFileRoute("/dashboard/streams/$id")({
  component: StreamDetailPage,
});

function StreamDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    getStream(id)
      .then((data) => {
        setStream(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load stream");
        setLoading(false);
      });
  }, [id, session]);

  const handleSave = async () => {
    if (!stream) return;
    setSaving(true);
    try {
      const updated = await updateStream(stream.id, { title, description });
      setStream(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stream");
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!stream) return;
    try {
      const updated = await publishStream(stream.id);
      setStream(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish stream");
    }
  };

  const handleCancel = async () => {
    if (!stream) return;
    if (!confirm("Are you sure you want to cancel this stream?")) return;
    try {
      const updated = await deleteStream(stream.id);
      setStream(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel stream");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">{error ?? "Stream not found."}</p>
      </div>
    );
  }

  const scheduledDate = new Date(stream.scheduledAt);
  const canEdit = stream.status === "draft" || stream.status === "scheduled";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/dashboard/streams" className="hover:text-blue-600">
            Streams
          </Link>
          <span>/</span>
          <span className="text-gray-900">{stream.title}</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Stream details */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div className="flex items-start justify-between">
            {editing ? (
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setTitle(stream.title);
                      setDescription(stream.description ?? "");
                    }}
                    className="px-4 py-1 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{stream.title}</h1>
                {stream.description && (
                  <p className="text-gray-500 mt-1">{stream.description}</p>
                )}
              </div>
            )}
            <StatusBadge status={stream.status} />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Scheduled</span>
              <p className="text-gray-900 font-medium">
                {scheduledDate.toLocaleDateString()} at{" "}
                {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Public URL</span>
              <p className="text-gray-900 font-mono text-xs">/event/{stream.slug}</p>
            </div>
            <div>
              <span className="text-gray-500">Channel</span>
              <p className="text-gray-900 font-mono text-xs">{stream.agoraChannelName}</p>
            </div>
            <div>
              <span className="text-gray-500">Host User</span>
              <p className="text-gray-900 font-mono text-xs">{stream.hostUserId}</p>
            </div>
            {stream.startedAt && (
              <div>
                <span className="text-gray-500">Started</span>
                <p className="text-gray-900">
                  {new Date(stream.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {stream.endedAt && (
              <div>
                <span className="text-gray-500">Ended</span>
                <p className="text-gray-900">
                  {new Date(stream.endedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Edit
              </button>
            )}

            {stream.status === "draft" && (
              <button
                type="button"
                onClick={handlePublish}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Publish (Make Scheduled)
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                Cancel Stream
              </button>
            )}

            {(stream.status === "completed" || stream.status === "processing") && (
              <Link
                to="/dashboard/streams/$id/recordings"
                params={{ id: stream.id }}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm"
              >
                View Recordings
              </Link>
            )}

            <a
              href={`/event/${stream.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Open Public Page
            </a>
          </div>
        </div>
      </div>
    </div>
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
