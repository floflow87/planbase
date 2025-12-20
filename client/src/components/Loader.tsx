import { RocketLoader } from "@/design-system/primitives/RocketLoader";
import { cn } from "@/lib/utils";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function Loader({ size = "md", className, text }: LoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <RocketLoader 
        size={size}
        showText={!!text}
        message={text || "PlanBase décolle…"}
        data-testid="loader-spinner"
      />
    </div>
  );
}
