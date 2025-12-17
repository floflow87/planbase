/**
 * DataTableShell Pattern
 * 
 * Complete table wrapper with:
 * - Title bar with optional actions
 * - Filter/search area
 * - Loading, empty, and error states
 * - Table content slot
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, type EmptyStateProps } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState, type ErrorStateProps } from "./ErrorState";

export interface DataTableShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  isEmpty?: boolean;
  emptyState?: Omit<EmptyStateProps, "className">;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
  variant?: "card" | "plain";
}

export const DataTableShell = React.forwardRef<HTMLDivElement, DataTableShellProps>(
  ({
    className,
    title,
    description,
    actions,
    filters,
    isLoading,
    loadingMessage,
    isEmpty,
    emptyState,
    error,
    onRetry,
    children,
    variant = "card",
    ...props
  }, ref) => {
    const content = (
      <>
        {(title || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              {title && (
                <h2 className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        )}
        
        {filters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {filters}
          </div>
        )}
        
        {error ? (
          <ErrorState 
            message={error.message} 
            onRetry={onRetry}
          />
        ) : isLoading ? (
          <LoadingState message={loadingMessage} />
        ) : isEmpty && emptyState ? (
          <EmptyState {...emptyState} />
        ) : (
          children
        )}
      </>
    );

    if (variant === "plain") {
      return (
        <div
          ref={ref}
          className={cn("w-full", className)}
          data-testid="data-table-shell"
          {...props}
        >
          {content}
        </div>
      );
    }

    return (
      <Card
        ref={ref}
        className={cn("w-full", className)}
        data-testid="data-table-shell"
        {...props}
      >
        <CardContent className="pt-6">
          {content}
        </CardContent>
      </Card>
    );
  }
);
DataTableShell.displayName = "DataTableShell";
