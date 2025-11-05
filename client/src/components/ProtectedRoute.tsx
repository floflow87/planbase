import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader } from "@/components/Loader";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  // CRITICAL: Don't render children if user is not authenticated
  // This prevents flash of protected content before redirect
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" text="Redirection..." />
      </div>
    );
  }

  return <>{children}</>;
}
