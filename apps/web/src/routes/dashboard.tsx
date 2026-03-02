import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-600">You need to sign in to view this page.</p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Session Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Name</span>
              <span className="text-gray-900">{session.user.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900">{session.user.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900 capitalize">
                {session.user.role}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">User ID</span>
              <span className="text-gray-900 font-mono text-xs">
                {session.user.id}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
