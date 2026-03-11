import { CountdownTimer } from "./CountdownTimer";

const EVENT_BANNER_IMAGE = "/luma-claude-code.avif";

export function EventBanner({
  targetDate,
  showCountdown = true,
  className = "",
}: {
  targetDate: string;
  showCountdown?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${className}`}
    >
      <img
        src={EVENT_BANNER_IMAGE}
        alt="Event banner"
        className="w-full h-full object-contain"
      />
      {showCountdown && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-200 text-sm font-medium">Event starts in</p>
          <CountdownTimer targetDate={targetDate} />
        </div>
      )}
    </div>
  );
}

export function EventBannerCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-t-xl ${className}`}>
      <img
        src={EVENT_BANNER_IMAGE}
        alt="Event banner"
        className="w-full aspect-square object-contain"
      />
    </div>
  );
}
