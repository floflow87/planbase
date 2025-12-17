/**
 * LoadingState Pattern
 * 
 * Consistent loading state for tables and lists.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, message = "Chargement...", size = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
      data-testid="loading-state"
      {...props}
    >
      <Loader2 
        className={cn("animate-spin text-muted-foreground mb-3", sizeClasses[size])} 
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
);
LoadingState.displayName = "LoadingState";
