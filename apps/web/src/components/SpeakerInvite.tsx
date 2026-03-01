import { useState } from "react";
import { authClient } from "~/lib/auth-client";

const AUTH_URL =
  import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788";

/**
 * Self-contained component for admins/owners to generate a speaker magic link.
 * Renders nothing if the user is not signed in or lacks admin/owner role.
 */
export function SpeakerInvite() {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (isPending) return null;
  if (!session) return null;
  if (session.user.role !== "owner" && session.user.role !== "admin")
    return null;

  const handleGenerate = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setGeneratedUrl(null);
    setCopied(false);

    try {
      const res = await fetch(`${AUTH_URL}/api/speaker-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }

      const data = (await res.json()) as { url: string };
      setGeneratedUrl(data.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate link"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text in the input
    }
  };

  const handleReset = () => {
    setEmail("");
    setGeneratedUrl(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">
        Invite Speaker
      </h2>
      <p className="text-sm text-gray-400">
        Generate a magic link that will log someone in with the speaker role.
      </p>

      {!generatedUrl ? (
        <>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGenerate();
              }}
              placeholder="speaker@example.com"
              disabled={loading}
              className="flex-1 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-600 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !email.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Generating..." : "Generate Magic Link"}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-gray-400">
            Magic link for{" "}
            <span className="text-white font-medium">{email}</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={generatedUrl}
              className="flex-1 px-3 py-2 bg-gray-800 text-gray-300 text-xs font-mono rounded-lg border border-gray-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Generate another link
          </button>
        </div>
      )}
    </div>
  );
}
