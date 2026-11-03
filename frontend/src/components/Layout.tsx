import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { Button } from "./ui/button";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-3 py-1.5 text-sm font-medium transition",
    isActive ? "bg-leaf-600 text-cream" : "text-leaf-700 hover:bg-leaf-100",
  ].join(" ");

export function Layout() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-leaf-300/30 bg-cream/90 backdrop-blur">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold text-leaf-700">
              ReWear
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-charcoal/50 sm:inline">
              reuse · restyle · rewear
            </span>
          </Link>

          <nav className="flex items-center gap-3" aria-label="Main">
            <NavLink to="/browse" className={linkClass}>
              Browse
            </NavLink>
            {isAuthenticated && user ? (
              <>
                <NavLink to="/sell" className={linkClass}>
                  Sell
                </NavLink>
                <span className="hidden text-sm text-charcoal/60 xs:inline">
                  Hi, {user.display_name}
                </span>
                <Button variant="ghost" onClick={() => void logout()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-leaf-600 px-4 py-1.5 text-sm font-semibold text-leaf-700 transition hover:bg-leaf-50"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-leaf-300/30 py-6 text-xs text-charcoal/60">
        <div className="shell flex flex-wrap items-center justify-between gap-3">
          <span>ReWear — pre-loved fashion, better for the planet.</span>
          <span>Buy · Sell · Trade · Donate · Auction</span>
        </div>
      </footer>
    </div>
  );
}
