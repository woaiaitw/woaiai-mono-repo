interface HostControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

export function HostControls({
  audioEnabled,
  videoEnabled,
  screenShareEnabled,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
}: HostControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 p-4 bg-gray-900/80 backdrop-blur">
      <button
        onClick={onToggleAudio}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          audioEnabled
            ? "bg-gray-700 text-white hover:bg-gray-600"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {audioEnabled ? "Mic On" : "Mic Off"}
      </button>
      <button
        onClick={onToggleVideo}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          videoEnabled
            ? "bg-gray-700 text-white hover:bg-gray-600"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {videoEnabled ? "Camera On" : "Camera Off"}
      </button>
      <button
        onClick={onToggleScreenShare}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          screenShareEnabled
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
      >
        {screenShareEnabled ? "Stop Sharing" : "Share Screen"}
      </button>
      <button
        onClick={onLeave}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
        Leave
      </button>
    </div>
  );
}
