import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { useState, useEffect, useCallback } from "react";

const AUTH_URL =
  import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788";

const VALID_ROLES = ["owner", "admin", "speaker", "user"] as const;
type Role = (typeof VALID_ROLES)[number];

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  createdAt: string;
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { data: session, isPending: sessionPending } =
    authClient.useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AUTH_URL}/api/admin/users`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      const data = (await res.json()) as { users: UserRow[] };
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && (session.user.role === "owner" || session.user.role === "admin")) {
      fetchUsers();
    }
  }, [session, fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingId(userId);
    setError(null);
    try {
      const res = await fetch(`${AUTH_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update role"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (sessionPending) {
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
          <p className="text-gray-600">
            You need to sign in to view this page.
          </p>
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

  if (session.user.role !== "owner" && session.user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            You do not have permission to access this page.
          </p>
          <Link
            to="/dashboard"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentUserRole = session.user.role as Role;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">
          User Management
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">
              Loading users...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => {
                  const isSelf = user.id === session.user.id;
                  const isTargetOwner = user.role === "owner";
                  const canEdit =
                    !isSelf &&
                    !(currentUserRole === "admin" && isTargetOwner);

                  const availableRoles =
                    currentUserRole === "owner"
                      ? VALID_ROLES
                      : VALID_ROLES.filter((r) => r !== "owner");

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        {canEdit ? (
                          <select
                            value={user.role}
                            disabled={updatingId === user.id}
                            onChange={(e) =>
                              handleRoleChange(
                                user.id,
                                e.target.value as Role
                              )
                            }
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white disabled:opacity-50"
                          >
                            {availableRoles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-700 inline-flex items-center gap-1">
                            {user.role}
                            {isSelf && (
                              <span className="text-xs text-gray-400">
                                (you)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
