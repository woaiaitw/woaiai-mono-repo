import { useState, useCallback } from "react";
import type { StreamEventHost } from "@web-template/shared";

interface StreamSetupChecklistProps {
  event: StreamEventHost;
  onProvision: () => Promise<void>;
  error?: string;
}

interface ChecklistItemProps {
  stepIndex: number;
  title: string;
  checked: boolean;
  expanded: boolean;
  onToggle: (stepIndex: number) => void;
  children: React.ReactNode;
  /** If true, the item cannot be manually toggled (derived state) */
  derived?: boolean;
}

function ChecklistItem({
  stepIndex,
  title,
  checked,
  expanded,
  onToggle,
  children,
  derived,
}: ChecklistItemProps) {
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => !derived && onToggle(stepIndex)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${
          derived ? "cursor-default" : "cursor-pointer hover:bg-card-hover"
        }`}
      >
        {/* Check circle */}
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-green-600 border-green-600 text-white"
              : "border-edge text-transparent"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>

        {/* Step number + title */}
        <span className="flex-1 font-medium text-heading">
          <span className="text-subtle mr-2">Step {stepIndex + 1}.</span>
          {title}
        </span>

        {/* Expand/collapse chevron (hidden for derived items) */}
        {!derived && (
          <svg
            className={`w-5 h-5 text-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-edge">
          <div className="pt-4 text-sm text-subtle leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function StreamSetupChecklist({
  event,
  onProvision,
  error,
}: StreamSetupChecklistProps) {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [expandedStep, setExpandedStep] = useState(0);
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);

  const step0Complete = !!event.mux_stream_key;

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      await onProvision();
      // Auto-advance to step 1 after provision
      setExpandedStep(1);
    } finally {
      setProvisioning(false);
    }
  };

  const handleToggle = useCallback(
    (stepIndex: number) => {
      setCheckedSteps((prev) => {
        const next = new Set(prev);
        if (next.has(stepIndex)) {
          // Uncheck → re-expand
          next.delete(stepIndex);
          setExpandedStep(stepIndex);
        } else {
          // Check → collapse and auto-expand next unchecked
          next.add(stepIndex);
          // Find next unchecked step after this one
          let nextStep = stepIndex;
          for (let i = stepIndex + 1; i <= 5; i++) {
            if (!next.has(i)) {
              nextStep = i;
              break;
            }
          }
          setExpandedStep(nextStep);
        }
        return next;
      });
    },
    [],
  );

  const copyToClipboard = async (text: string, type: "key" | "url") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      title: "Get stream key",
      derived: true,
      content: (
        <>
          {!step0Complete ? (
            <div className="space-y-3">
              <p>
                Provision a Mux live stream for this event. This generates an
                RTMP URL and stream key you'll paste into OBS.
              </p>
              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
              >
                {provisioning ? "Provisioning..." : "Provision Stream"}
              </button>
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-subtle uppercase tracking-wide">
                  RTMP Server
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-input px-4 py-2 rounded-lg text-sm font-mono text-heading">
                    {event.rtmpUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(event.rtmpUrl, "url")}
                    className="px-3 py-2 bg-input rounded-lg hover:bg-card-hover text-sm transition-colors"
                  >
                    {copied === "url" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-subtle uppercase tracking-wide">
                  Stream Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-input px-4 py-2 rounded-lg text-sm font-mono text-heading truncate">
                    {event.mux_stream_key}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(event.mux_stream_key || "", "key")
                    }
                    className="px-3 py-2 bg-input rounded-lg hover:bg-card-hover text-sm transition-colors"
                  >
                    {copied === "key" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      title: "Set the values in OBS in Settings > Stream",
      content: (
        <div className="space-y-4">
          <p>Open OBS Studio and go to <strong>Settings &rarr; Stream</strong>:</p>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-heading mb-1">1. Open Settings</p>
              <img
                src="/obs/obs-open-settings.png"
                alt="Open OBS Settings"
                className="rounded-lg border border-edge max-w-full"
              />
            </div>

            <div>
              <p className="font-medium text-heading mb-1">2. Go to the Stream tab</p>
              <img
                src="/obs/obs-stream-tab.png"
                alt="The Stream tab in OBS settings"
                className="rounded-lg border border-edge max-w-full"
              />
            </div>

            <div>
              <p className="font-medium text-heading mb-1">
                3. Select "Custom..." as the service
              </p>
              <img
                src="/obs/obs-select-custom.png"
                alt="Selecting Custom service in OBS"
                className="rounded-lg border border-edge max-w-full"
              />
            </div>

            <div>
              <p className="font-medium text-heading mb-1">
                4. Paste the RTMP Server and Stream Key
              </p>
              <img
                src="/obs/obs-paste-values.png"
                alt="Pasting RTMP Server and Stream Key in OBS"
                className="rounded-lg border border-edge max-w-full"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Open Chrome and set the URL",
      content: (
        <div className="space-y-2">
          <p>
            Open <strong>Google Chrome</strong> and navigate to the app URL you
            want to stream. A few tips:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Don't use full screen &mdash; OBS needs to capture the window</li>
            <li>Keep only one tab open for a cleaner capture</li>
            <li>Make sure the page is fully loaded before continuing</li>
          </ul>
        </div>
      ),
    },
    {
      title: "Add source for window capture in OBS",
      content: (
        <div className="space-y-2">
          <p>In OBS, add a new source for the Chrome window:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>
              Click the <strong>+</strong> button under <strong>Sources</strong>
            </li>
            <li>
              Select <strong>Window Capture</strong>
            </li>
            <li>Choose the Chrome window from the dropdown</li>
          </ol>
        </div>
      ),
    },
    {
      title: "Resize and reposition the window in OBS",
      content: (
        <p>
          In the OBS canvas, click and drag the source to resize and reposition
          it. Make sure the Chrome window fills the area you want viewers to see.
        </p>
      ),
    },
    {
      title: "Click start stream in OBS",
      content: (
        <div className="space-y-2">
          <p>
            Click <strong>"Start Streaming"</strong> in the bottom-right of OBS.
          </p>
          <p>
            It may take up to <strong>10 seconds</strong> for the stream to
            register and the preview to begin. Once OBS connects, the event
            status will change to "Preview" and you'll see the live controls.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-card border border-edge rounded-xl p-6 space-y-4">
      <h3 className="text-xl font-semibold">Stream Setup Checklist</h3>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <ChecklistItem
            key={i}
            stepIndex={i}
            title={step.title}
            checked={i === 0 ? step0Complete : checkedSteps.has(i)}
            expanded={i === 0 ? true : expandedStep === i}
            onToggle={handleToggle}
            derived={i === 0 ? true : step.derived}
          >
            {step.content}
          </ChecklistItem>
        ))}
      </div>
    </div>
  );
}
