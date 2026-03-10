import { useState, useEffect } from "react";

function computeTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(computeTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const segments = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Min" },
    { value: timeLeft.seconds, label: "Sec" },
  ];

  return (
    <div className="flex gap-3 justify-center">
      {segments.map((seg) => (
        <div
          key={seg.label}
          className="flex flex-col items-center bg-card border border-edge rounded-lg px-4 py-3 min-w-[4rem]"
        >
          <span className="text-2xl font-bold text-heading tabular-nums">
            {String(seg.value).padStart(2, "0")}
          </span>
          <span className="text-xs text-subtle mt-1">{seg.label}</span>
        </div>
      ))}
    </div>
  );
}
