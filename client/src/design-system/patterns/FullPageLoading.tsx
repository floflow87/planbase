/**
 * FullPageLoading Pattern
 * 
 * Full-page centered loading state for app boot, auth, and session initialization.
 * Uses the RocketLoader for consistent PlanBase brand identity.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { RocketLoader } from "../primitives/RocketLoader";

export interface FullPageLoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export const FullPageLoading = React.forwardRef<HTMLDivElement, FullPageLoadingProps>(
  ({ className, message = "PlanBase décolle…", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background z-50",
        className
      )}
      data-testid="full-page-loading"
      {...props}
    >
      <RocketLoader size="lg" showText message={message} />
    </div>
  )
);
FullPageLoading.displayName = "FullPageLoading";
