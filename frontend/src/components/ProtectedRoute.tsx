import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";

export function ProtectedRoute() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <div className="shell py-20 text-center text-sm text-charcoal/60">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
