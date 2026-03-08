import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { createStream, getStream } from "../lib/mux-client";
import type { MuxStreamInfo } from "@web-template/shared";

export const Route = createFileRoute("/stream")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: (search.role as "host" | "viewer") || "viewer",
    playbackId: (search.playbackId as string) || "",
    streamId: (search.streamId as string) || "",
  }),
  component: StreamPage,
});

function StreamPage() {
  const { role, playbackId, streamId } = Route.useSearch();
  const navigate = useNavigate();

  if (role === "host") {
    return <HostPanel />;
  }

  return (
    <ViewerPanel
      playbackId={playbackId}
      streamId={streamId}
      onBack={() => navigate({ to: "/" })}
    />
  );
}

// ─── Host Panel ──────────────────────────────────────────────

function HostPanel() {
  const [stream, setStream] = useState<MuxStreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  const navigate = useNavigate();

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const s = await createStream();
      setStream(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create stream");
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    if (!stream) return;
    try {
      const updated = await getStream(stream.id);
      setStream((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch {
      // ignore polling errors
    }
  }, [stream]);

  // Poll status every 5s while stream exists
  useEffect(() => {
    if (!stream) return;
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [stream, refreshStatus]);

  const copyToClipboard = async (text: string, type: "key" | "url") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Stream Host</h1>
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Back
          </button>
        </div>

        {!stream ? (
          <div className="space-y-4">
            <p className="text-gray-400">
              Create a live stream, then configure OBS with the provided RTMP
              URL and stream key.
            </p>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Live Stream"}
            </button>
            {error && <p className="text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Status:</span>
              <StatusBadge status={stream.status} />
            </div>

            {/* OBS Configuration */}
            <div className="bg-gray-900 rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">OBS Configuration</h2>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">RTMP Server</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono">
                    {stream.rtmpUrl}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(stream.rtmpUrl || "", "url")
                    }
                    className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                  >
                    {copied === "url" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Stream Key</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono truncate">
                    {stream.streamKey}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(stream.streamKey || "", "key")
                    }
                    className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                  >
                    {copied === "key" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Viewer Link */}
            <div className="bg-gray-900 rounded-xl p-6 space-y-2">
              <h2 className="text-xl font-semibold">Viewer Link</h2>
              <p className="text-sm text-gray-400">
                Share this link with your audience:
              </p>
              <code className="block bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono break-all">
                {window.location.origin}/stream?playbackId=
                {stream.playbackId}&streamId={stream.id}
              </code>
            </div>

            {/* Preview (if live) */}
            {stream.status === "active" && stream.playbackId && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-2">
                <h2 className="text-xl font-semibold">Live Preview</h2>
                <MuxPlayerEmbed playbackId={stream.playbackId} />
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-900/50 rounded-xl p-6 space-y-2 text-sm text-gray-400">
              <h3 className="text-white font-semibold">Quick Start</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Open OBS Studio &rarr; Settings &rarr; Stream
                </li>
                <li>Set Service to "Custom"</li>
                <li>Paste the RTMP Server and Stream Key above</li>
                <li>Click "Start Streaming" in OBS</li>
                <li>
                  This page will show "Active" once the stream is live
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Viewer Panel ────────────────────────────────────────────

function ViewerPanel({
  playbackId,
  streamId,
  onBack,
}: {
  playbackId: string;
  streamId: string;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<string>("loading");

  // Poll stream status
  useEffect(() => {
    if (!streamId) {
      setStatus(playbackId ? "ready" : "no-stream");
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const s = await getStream(streamId);
        if (!cancelled) setStatus(s.status);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [streamId, playbackId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Live Stream</h1>
          <StatusBadge status={status} />
        </div>
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {!playbackId ? (
          <p className="text-gray-500 text-lg">
            No stream available. Ask the host for a viewer link.
          </p>
        ) : status === "idle" ? (
          <div className="text-center space-y-2">
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-lg">
              Waiting for stream to go live...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-5xl">
            <MuxPlayerEmbed playbackId={playbackId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    idle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    disabled: "bg-red-500/20 text-red-400 border-red-500/30",
    loading: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const labels: Record<string, string> = {
    active: "Live",
    idle: "Idle",
    disabled: "Disabled",
    loading: "Loading...",
    error: "Error",
    ready: "Ready",
    "no-stream": "No Stream",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.loading}`}
    >
      {labels[status] || status}
    </span>
  );
}

function MuxPlayerEmbed({ playbackId }: { playbackId: string }) {
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <iframe
        src={`https://player.mux.com/${playbackId}`}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
