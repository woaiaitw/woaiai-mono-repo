import { useState } from "react";
import type { StreamEventHost } from "@web-template/shared";
import { provisionEvent, goLive, endEvent } from "~/lib/mux-client";

interface HostStreamControlsProps {
  event: StreamEventHost;
  onUpdate: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-subtle">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm text-body bg-input px-3 py-2 rounded-lg truncate">
          {text}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 px-3 py-2 text-xs font-medium bg-input text-body rounded-lg hover:bg-card-hover transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function HostStreamControls({
  event,
  onUpdate,
}: HostStreamControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (
    action: () => Promise<unknown>,
    errorMsg: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      onUpdate();
    } catch {
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isProvisioned = !!event.mux_stream_id;

  return (
    <div className="bg-card border border-edge rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-body uppercase tracking-wider">
        Host Controls
      </h3>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Scheduled, not provisioned */}
      {event.status === "scheduled" && !isProvisioned && (
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            handleAction(
              () => provisionEvent(event.id),
              "Failed to provision stream"
            )
          }
          className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Provisioning..." : "Provision Stream"}
        </button>
      )}

      {/* Provisioned — show OBS credentials */}
      {isProvisioned && event.status !== "ended" && (
        <div className="space-y-3">
          <CopyButton text={event.rtmpUrl} label="RTMP URL" />
          {event.mux_stream_key && (
            <CopyButton text={event.mux_stream_key} label="Stream Key" />
          )}
          <p className="text-xs text-faint">
            Paste these into OBS Studio under Settings &rarr; Stream
          </p>
        </div>
      )}

      {/* Preview — Go Live */}
      {event.status === "preview" && (
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            handleAction(() => goLive(event.id), "Failed to go live")
          }
          className="w-full px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Going Live..." : "Go Live"}
        </button>
      )}

      {/* Live — End Stream */}
      {event.status === "live" && (
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            handleAction(() => endEvent(event.id), "Failed to end stream")
          }
          className="w-full px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Ending..." : "End Stream"}
        </button>
      )}
    </div>
  );
}
