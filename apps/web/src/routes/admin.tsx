import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
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
      <div className="min-h-screen flex items-center justify-center bg-page">
        <p className="text-subtle">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-4">
          <p className="text-body">
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
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-4">
          <p className="text-body">
            You do not have permission to access this page.
          </p>
          <Link
            to="/"
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
    <div className="min-h-screen bg-page p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-heading">
            User Management
          </h1>
          <Link
            to="/"
            className="px-4 py-2 text-sm text-body border border-edge-hover rounded-lg hover:bg-card-hover transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-subtle">
              Loading users...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-edge bg-page">
                  <th className="text-left px-6 py-3 text-xs font-medium text-subtle uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-subtle uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-subtle uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-subtle uppercase tracking-wider">
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
                    <tr key={user.id} className="hover:bg-card-hover">
                      <td className="px-6 py-4 text-sm text-heading">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-subtle">
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
                            className="text-sm border border-edge-hover rounded-md px-2 py-1 bg-card disabled:opacity-50"
                          >
                            {availableRoles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-body inline-flex items-center gap-1">
                            {user.role}
                            {isSelf && (
                              <span className="text-xs text-faint">
                                (you)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-subtle">
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
