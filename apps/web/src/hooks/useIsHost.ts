import { authClient } from "~/lib/auth-client";
import type { UserRole } from "@web-template/shared";

const HOST_ROLES: UserRole[] = ["owner", "admin"];

export function useIsHost(): { isHost: boolean; isLoading: boolean } {
  const { data: session, isPending } = authClient.useSession();
  const role = session?.user?.role as UserRole | undefined;
  return {
    isHost: !!role && HOST_ROLES.includes(role),
    isLoading: isPending,
  };
}
