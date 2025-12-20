/**
 * SavingIndicator - Inline Saving State Component
 * 
 * A lightweight inline indicator for showing saving/syncing states.
 * Pairs with optimistic updates to provide immediate visual feedback.
 */
import * as React from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SavingState = "idle" | "saving" | "saved" | "error";

export interface SavingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  state: SavingState;
  savingText?: string;
  savedText?: string;
  errorText?: string;
  showIcon?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const SavingIndicator = React.forwardRef<HTMLDivElement, SavingIndicatorProps>(
  ({ 
    className,
    state,
    savingText = "Enregistrement...",
    savedText = "Enregistré",
    errorText = "Erreur",
    showIcon = true,
    autoHide = true,
    autoHideDelay = 2000,
    ...props 
  }, ref) => {
    const [visible, setVisible] = React.useState(true);
    
    React.useEffect(() => {
      if (state === "idle") {
        setVisible(false);
        return;
      }
      
      setVisible(true);
      
      if (autoHide && state === "saved") {
        const timer = setTimeout(() => setVisible(false), autoHideDelay);
        return () => clearTimeout(timer);
      }
    }, [state, autoHide, autoHideDelay]);
    
    if (!visible && state !== "saving" && state !== "error") {
      return null;
    }
    
    const stateConfig = {
      idle: { icon: null, text: "", className: "" },
      saving: {
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: savingText,
        className: "text-muted-foreground",
      },
      saved: {
        icon: <Check className="w-3 h-3" />,
        text: savedText,
        className: "text-green-600 dark:text-green-400",
      },
      error: {
        icon: <AlertCircle className="w-3 h-3" />,
        text: errorText,
        className: "text-destructive",
      },
    };
    
    const config = stateConfig[state];
    
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition-opacity duration-200",
          config.className,
          className
        )}
        role="status"
        aria-live="polite"
        data-testid={`saving-indicator-${state}`}
        {...props}
      >
        {showIcon && config.icon}
        <span>{config.text}</span>
      </div>
    );
  }
);

SavingIndicator.displayName = "SavingIndicator";

/**
 * Hook for managing saving indicator state
 * 
 * @example
 * const { state, setSaving, setSaved, setError, reset } = useSavingState();
 * 
 * mutation.mutate(data, {
 *   onMutate: () => setSaving(),
 *   onSuccess: () => setSaved(),
 *   onError: () => setError(),
 * });
 */
export function useSavingState(initialState: SavingState = "idle") {
  const [state, setState] = React.useState<SavingState>(initialState);
  
  const setSaving = React.useCallback(() => setState("saving"), []);
  const setSaved = React.useCallback(() => setState("saved"), []);
  const setError = React.useCallback(() => setState("error"), []);
  const reset = React.useCallback(() => setState("idle"), []);
  
  return { state, setState, setSaving, setSaved, setError, reset };
}

/**
 * MutationStateIndicator - Automatically tracks mutation state
 * 
 * @example
 * <MutationStateIndicator isPending={mutation.isPending} isSuccess={mutation.isSuccess} isError={mutation.isError} />
 */
export interface MutationStateIndicatorProps extends Omit<SavingIndicatorProps, "state"> {
  isPending?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
}

export const MutationStateIndicator = React.forwardRef<HTMLDivElement, MutationStateIndicatorProps>(
  ({ isPending, isSuccess, isError, ...props }, ref) => {
    const [showSuccess, setShowSuccess] = React.useState(false);
    
    React.useEffect(() => {
      if (isSuccess) {
        setShowSuccess(true);
        const timer = setTimeout(() => setShowSuccess(false), 2000);
        return () => clearTimeout(timer);
      }
    }, [isSuccess]);
    
    let state: SavingState = "idle";
    if (isPending) state = "saving";
    else if (isError) state = "error";
    else if (showSuccess) state = "saved";
    
    return <SavingIndicator ref={ref} state={state} {...props} />;
  }
);

MutationStateIndicator.displayName = "MutationStateIndicator";
