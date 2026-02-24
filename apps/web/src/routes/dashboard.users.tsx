import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { authClient } from "~/lib/auth-client";
import type { UserRole } from "@web-template/shared";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean | null;
  createdAt: string;
}

function UsersPage() {
  const { data: session } = authClient.useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const role = session?.user?.role as string | undefined;
  const isAdmin = role === "admin";

  const fetchUsers = useCallback(async () => {
    try {
      const result = await authClient.admin.listUsers({
        limit: 100,
        sortBy: "name",
        sortDirection: "asc",
      });
      if (result.data) {
        setUsers(result.data.users as AdminUser[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !isAdmin) return;
    fetchUsers();
  }, [session, isAdmin, fetchUsers]);

  const handleSetRole = async (userId: string, newRole: UserRole) => {
    if (userId === session?.user?.id) {
      setError("You cannot change your own role");
      return;
    }

    setUpdating(userId);
    setError(null);

    try {
      await authClient.admin.setRole({ userId, role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-600">Admin access required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const admins = filtered.filter((u) => u.role === "admin");
  const hosts = filtered.filter((u) => u.role === "host");
  const viewers = filtered.filter((u) => u.role === "viewer" || !u.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <span className="text-sm text-gray-500">{users.length} users</span>
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">No users found</p>
        </div>
      )}

      {admins.length > 0 && (
        <UserGroup
          title="Admins"
          users={admins}
          currentUserId={session?.user?.id}
          updating={updating}
          onSetRole={handleSetRole}
        />
      )}

      {hosts.length > 0 && (
        <UserGroup
          title="Hosts"
          users={hosts}
          currentUserId={session?.user?.id}
          updating={updating}
          onSetRole={handleSetRole}
        />
      )}

      {viewers.length > 0 && (
        <UserGroup
          title="Viewers"
          users={viewers}
          currentUserId={session?.user?.id}
          updating={updating}
          onSetRole={handleSetRole}
        />
      )}
    </div>
  );
}

function UserGroup({
  title,
  users,
  currentUserId,
  updating,
  onSetRole,
}: {
  title: string;
  users: AdminUser[];
  currentUserId?: string;
  updating: string | null;
  onSetRole: (userId: string, role: UserRole) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title} ({users.length})
      </h2>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {users.map((user) => (
          <div key={user.id} className="px-5 py-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
                {user.id === currentUserId && (
                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                )}
              </p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {user.id === currentUserId ? (
                <RoleBadge role={user.role} />
              ) : (
                <select
                  value={user.role || "viewer"}
                  onChange={(e) => onSetRole(user.id, e.target.value as UserRole)}
                  disabled={updating === user.id}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="host">Host</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    host: "bg-blue-100 text-blue-700",
    viewer: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${styles[role] ?? styles.viewer}`}
    >
      {role || "viewer"}
    </span>
  );
}
