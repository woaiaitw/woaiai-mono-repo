import type { CaptionEntry } from "../hooks/useCaptions";

export function CaptionOverlay({
  captions,
  interimText,
}: {
  captions: CaptionEntry[];
  interimText: string;
}) {
  const hasContent = captions.length > 0 || interimText;
  if (!hasContent) return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4">
      <div className="bg-black/75 backdrop-blur-sm rounded-lg px-6 py-3 max-w-3xl">
        {captions.map((caption) => (
          <p key={caption.id} className="text-white text-lg leading-relaxed">
            {caption.text}
          </p>
        ))}
        {interimText && (
          <p className="text-gray-300 text-lg leading-relaxed italic">
            {interimText}
          </p>
        )}
      </div>
    </div>
  );
}
