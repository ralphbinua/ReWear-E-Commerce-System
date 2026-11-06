import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";

export function ProtectedRoute() {
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="shell py-20 text-center text-sm text-charcoal/60">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith("/admin")
      ? "/admin/login"
      : "/rewear/login";
    return (
      <Navigate
        to={`${loginPath}?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <Outlet />;
}
