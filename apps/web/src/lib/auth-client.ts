import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_WORKER_URL ?? "http://localhost:8788",
  fetchOptions: {
    credentials: "include",
  },
});
