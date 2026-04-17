import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user } = useAuth();
  const location = useLocation();
  const normalizedRole = user?.role === "user" ? "customer" : user?.role;
  const normalizedAllowedRoles = allowedRoles.map((role) => (role === "user" ? "customer" : role));

  if (user === undefined) {
    return (
      <div className="h-screen flex items-center justify-center">
        <span className="text-slate-500">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          message: "Please register or log in first to continue to the shop.",
        }}
      />
    );
  }

  if (allowedRoles.length && !normalizedAllowedRoles.includes(normalizedRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
