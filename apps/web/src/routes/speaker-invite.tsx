import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/speaker-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite_token: (search.invite_token as string) || "",
  }),
  component: SpeakerInvitePage,
});

function SpeakerInvitePage() {
  const navigate = useNavigate();
  const { invite_token } = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invite_token || !session || activating || activated || error) return;

    setActivating(true);
    const authUrl =
      import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788";
    fetch(`${authUrl}/api/speaker-invite/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ invite_token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setActivated(true);
        } else {
          const body = await res.json();
          setError(body.error || "Failed to activate speaker role");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setActivating(false));
  }, [invite_token, session, activating, activated, error]);

  if (isPending || activating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <p className="text-subtle">Setting up your speaker access...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-4">
          <p className="text-body">Verifying your invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">
            Invite Error
          </h1>
          <p className="text-body">{error}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 text-sm text-blue-600 hover:text-blue-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-heading">
          Welcome, Speaker!
        </h1>
        <p className="text-body">
          You have been granted speaker access.
        </p>
        <div className="bg-card rounded-xl shadow-sm p-4 inline-block">
          <span className="text-sm text-subtle">Role: </span>
          <span className="text-sm font-semibold text-blue-600 capitalize">
            speaker
          </span>
        </div>
        <div>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
