interface HandRaise {
  uid: number;
  name: string;
  userId: string;
  raisedAt: number;
}

interface SpeakerPanelProps {
  handRaises: HandRaise[];
  activeSpeakers: { uid: number; name?: string }[];
  maxSpeakers: number;
  onPromote: (uid: number) => void;
  onDemote: (uid: number) => void;
  onTransferHost: (uid: number) => void;
}

export function SpeakerPanel({
  handRaises,
  activeSpeakers,
  maxSpeakers,
  onPromote,
  onDemote,
  onTransferHost,
}: SpeakerPanelProps) {
  const canPromoteMore = activeSpeakers.length < maxSpeakers;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
        Speaker Management
      </h3>

      {/* Active Speakers */}
      {activeSpeakers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-gray-400">
            Active Speakers ({activeSpeakers.length}/{maxSpeakers})
          </h4>
          {activeSpeakers.map((speaker) => (
            <div
              key={speaker.uid}
              className="flex items-center justify-between p-2 bg-gray-700 rounded"
            >
              <span className="text-sm text-white">
                {speaker.name ?? `Speaker ${speaker.uid}`}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onDemote(speaker.uid)}
                  className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Demote
                </button>
                <button
                  type="button"
                  onClick={() => onTransferHost(speaker.uid)}
                  className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Make Host
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hand Raises */}
      {handRaises.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-gray-400">
            Raised Hands ({handRaises.length})
          </h4>
          {handRaises.map((raise) => (
            <div
              key={raise.uid}
              className="flex items-center justify-between p-2 bg-gray-700 rounded"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✋</span>
                <span className="text-sm text-white">{raise.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onPromote(raise.uid)}
                disabled={!canPromoteMore}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Promote
              </button>
            </div>
          ))}
        </div>
      )}

      {handRaises.length === 0 && activeSpeakers.length === 0 && (
        <p className="text-sm text-gray-500">No active speakers or hand raises</p>
      )}
    </div>
  );
}
