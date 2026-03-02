import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { Header } from "~/components/Header";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Web Template" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

/** Routes where the header should be hidden (full-screen experiences). */
const HEADERLESS_ROUTES = ["/meeting"];

function RootComponent() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const showHeader = !HEADERLESS_ROUTES.includes(currentPath);

  return (
    <RootDocument>
      {showHeader && <Header />}
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
