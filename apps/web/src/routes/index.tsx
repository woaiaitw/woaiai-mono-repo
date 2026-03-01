import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_LANGUAGE } from "@web-template/shared";
import { LanguageSelect } from "../components/LanguageSelect";
import { SpeakerInvite } from "../components/SpeakerInvite";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Live Broadcast</h1>
          <p className="text-lg text-gray-400">
            Real-time video with live transcription
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <div className="flex gap-2 items-center">
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              className="px-4 py-4 bg-gray-800 text-white text-lg font-semibold rounded-xl border border-gray-600 hover:bg-gray-700 transition-colors"
            />
            <Link
              to="/meeting"
              search={{ role: "host", lang: language }}
              className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Start as Host
            </Link>
          </div>
          <Link
            to="/meeting"
            search={{ role: "viewer", lang: DEFAULT_LANGUAGE }}
            className="inline-block px-8 py-4 border border-gray-600 text-gray-200 text-lg font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Join as Viewer
          </Link>
        </div>
        <SpeakerInvite />
      </div>
    </div>
  );
}
