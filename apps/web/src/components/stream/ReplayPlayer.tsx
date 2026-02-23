import { useState, useEffect } from "react";
import { getRecordingUrl } from "~/lib/video-client";

interface ReplayPlayerProps {
  streamId: string;
  title: string;
}

export function ReplayPlayer({ streamId, title }: ReplayPlayerProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecordingUrl(streamId)
      .then((data) => {
        setDownloadUrl(data.downloadUrl);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load recording");
        setLoading(false);
      });
  }, [streamId]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">Loading recording...</p>
      </div>
    );
  }

  if (error || !downloadUrl) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-gray-400">Recording not available yet</p>
          <p className="text-sm text-gray-500">
            {error ?? "The recording may still be processing. Check back later."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <video
        controls
        className="w-full rounded-lg bg-gray-900"
        src={downloadUrl}
        title={title}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
