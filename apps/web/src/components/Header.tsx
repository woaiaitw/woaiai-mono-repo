import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";

export function Header() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { data: session, isPending } = authClient.useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = !!session;
  const isAdmin =
    isLoggedIn &&
    (session.user.role === "owner" || session.user.role === "admin");

  const handleSignOut = async () => {
    await authClient.signOut();
    setMobileMenuOpen(false);
    navigate({ to: "/" });
  };

  const navLinks = [
    { to: "/" as const, label: "Home" },
    ...(isLoggedIn
      ? [{ to: "/dashboard" as const, label: "Dashboard" }]
      : []),
    ...(isAdmin
      ? [{ to: "/admin" as const, label: "Admin" }]
      : []),
  ];

  const isActive = (path: string) => currentPath === path;

  return (
    <header className="w-full bg-white shadow-sm">
      {/* Top level: Logo + Auth */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo placeholder - wide spaced */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-[0.15em] text-gray-900">
                WOAI AI
              </span>
            </Link>

            {/* Auth actions - desktop */}
            <div className="hidden sm:flex items-center gap-3">
              {isPending ? (
                <span className="text-sm text-gray-400">Loading...</span>
              ) : isLoggedIn ? (
                <>
                  <span className="text-sm text-gray-600">
                    {session.user.name || session.user.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Second level: Navigation bar - desktop */}
      <div className="hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 h-12">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(link.to)
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  isActive(link.to)
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-gray-100">
            {isPending ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : isLoggedIn ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 px-4">
                  {session.user.name || session.user.email}
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full px-4 py-2.5 text-sm text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
