import {
  Outlet,
  HeadContent,
  Scripts,
  Link,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "~/lib/auth-client";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WOAI AI" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function NavBar() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
        <Link to="/" className="block">
          <img src="/logo.svg" alt="WOAI AI" className="h-6" />
        </Link>

        <div className="flex items-center gap-4">
          {isPending ? (
            <div className="h-8 w-20 bg-gray-800 rounded-lg animate-pulse" />
          ) : user ? (
            <>
              <span className="text-sm text-gray-400 hidden sm:inline">
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={() => authClient.signOut()}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <NavBar />
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-950 text-white antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
