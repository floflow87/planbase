/**
 * LoadingState Pattern
 * 
 * Consistent loading state for tables and lists.
 * Uses the RocketLoader for PlanBase brand identity.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { RocketLoader } from "../primitives/RocketLoader";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: "sm" | "md" | "lg";
  showRocketText?: boolean;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, message, size = "md", showRocketText = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
      data-testid="loading-state"
      {...props}
    >
      <RocketLoader 
        size={size} 
        showText={showRocketText}
        message={message || "PlanBase décolle…"}
      />
    </div>
  )
);
LoadingState.displayName = "LoadingState";
