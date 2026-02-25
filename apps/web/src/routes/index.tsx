import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Live Broadcast</h1>
          <p className="text-lg text-gray-400">
            Real-time video with live transcription
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/meeting"
            search={{ role: "host" }}
            className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Start as Host
          </Link>
          <Link
            to="/meeting"
            search={{ role: "viewer" }}
            className="inline-block px-8 py-4 border border-gray-600 text-gray-200 text-lg font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Join as Viewer
          </Link>
        </div>
      </div>
    </div>
  );
}
