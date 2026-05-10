import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MobileCollapsibleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  testId?: string;
  ariaLabel?: string;
  desktopWidthClass?: string;
  onFocusChange?: (focused: boolean) => void;
}

export function MobileCollapsibleSearch({
  value,
  onChange,
  placeholder = "",
  className = "",
  inputClassName = "",
  testId,
  ariaLabel = "Rechercher",
  desktopWidthClass = "sm:max-w-[280px]",
  onFocusChange,
}: MobileCollapsibleSearchProps) {
  const [focused, setFocused] = useState(false);
  const expanded = focused || !!value;
  const setFocus = (f: boolean) => { setFocused(f); onFocusChange?.(f); };

  return (
    <div
      className={cn(
        "relative h-9 transition-[width,max-width,flex] duration-300 ease-in-out",
        expanded ? "flex-1 w-full" : "w-9 shrink-0",
        "sm:flex-1 sm:w-auto",
        desktopWidthClass,
        className,
      )}
    >
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none transition-all duration-300",
          expanded ? "left-2.5" : "left-1/2 -translate-x-1/2",
          "sm:left-2.5 sm:translate-x-0",
        )}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { if (!value) setFocus(false); }}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full text-[12px] bg-white dark:bg-background transition-all duration-300 placeholder:text-[10px]",
          expanded
            ? "pl-8 pr-8 placeholder:text-muted-foreground"
            : "pl-0 pr-0 cursor-pointer text-transparent caret-transparent placeholder:text-transparent",
          "sm:pl-8 sm:pr-8 sm:cursor-text sm:text-foreground sm:caret-current sm:placeholder:text-muted-foreground",
          inputClassName,
        )}
        data-testid={testId}
        aria-label={ariaLabel}
      />
      {(value || focused) && (
        <button
          type="button"
          onClick={() => { onChange(""); setFocus(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          data-testid={testId ? `${testId}-clear` : undefined}
          aria-label="Effacer la recherche"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
