import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { FullPageLoading } from "@/design-system/patterns/FullPageLoading";

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

  if (loading) {
    return <FullPageLoading message="Chargement..." />;
  }

  if (!user) {
    return <FullPageLoading message="Redirection..." />;
  }

  return <>{children}</>;
}
