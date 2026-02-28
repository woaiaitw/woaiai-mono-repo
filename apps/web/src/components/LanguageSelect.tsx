import { SUPPORTED_LANGUAGES } from "@web-template/shared";

interface LanguageSelectProps {
  value: string;
  onChange: (language: string) => void;
  className?: string;
}

export function LanguageSelect({
  value,
  onChange,
  className,
}: LanguageSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition-colors"
      }
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
