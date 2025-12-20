/**
 * RocketLoader - Premium Loading Animation
 * 
 * A signature "rocket launch" loader for PlanBase brand identity.
 * Features smooth animation with accessibility support.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface RocketLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  message?: string;
}

const sizeConfig = {
  sm: { container: "w-8 h-12", rocket: 24, flame: 8 },
  md: { container: "w-12 h-16", rocket: 36, flame: 12 },
  lg: { container: "w-16 h-24", rocket: 48, flame: 16 },
};

export const RocketLoader = React.forwardRef<HTMLDivElement, RocketLoaderProps>(
  ({ 
    className, 
    size = "md", 
    showText = false,
    message = "PlanBase décolle…",
    ...props 
  }, ref) => {
    const config = sizeConfig[size];
    
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center gap-3", className)}
        role="status"
        aria-label="Chargement"
        data-testid="rocket-loader"
        {...props}
      >
        <style>{`
          @keyframes rocketFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes flamePulse {
            0%, 100% { opacity: 1; transform: scaleY(1); }
            50% { opacity: 0.7; transform: scaleY(1.3); }
          }
          @keyframes flameFlicker {
            0%, 100% { opacity: 0.8; }
            25% { opacity: 1; }
            75% { opacity: 0.6; }
          }
          @keyframes loadingTextPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .rocket-float {
            animation: rocketFloat 1.4s ease-in-out infinite;
          }
          .flame-main {
            animation: flamePulse 0.8s ease-in-out infinite;
            transform-origin: center top;
          }
          .flame-inner {
            animation: flameFlicker 0.4s ease-in-out infinite;
          }
          .rocket-loading-text {
            animation: loadingTextPulse 2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .rocket-float, .flame-main, .flame-inner, .rocket-loading-text {
              animation: none !important;
            }
            .flame-main {
              opacity: 0.8;
            }
          }
        `}</style>
        
        <div className={cn("relative", config.container)}>
          <svg
            viewBox="0 0 48 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full rocket-float"
            aria-hidden="true"
          >
            {/* Rocket Body */}
            <path
              d="M24 4C24 4 32 12 32 28C32 36 28 42 24 42C20 42 16 36 16 28C16 12 24 4 24 4Z"
              className="fill-primary"
            />
            
            {/* Rocket Window */}
            <circle
              cx="24"
              cy="20"
              r="4"
              className="fill-primary-foreground"
            />
            <circle
              cx="24"
              cy="20"
              r="2.5"
              className="fill-primary/30"
            />
            
            {/* Left Fin */}
            <path
              d="M16 32L10 40L16 38V32Z"
              className="fill-primary/80"
            />
            
            {/* Right Fin */}
            <path
              d="M32 32L38 40L32 38V32Z"
              className="fill-primary/80"
            />
            
            {/* Bottom Base */}
            <path
              d="M20 42H28L26 46H22L20 42Z"
              className="fill-muted-foreground/60"
            />
            
            {/* Flame - Main */}
            <ellipse
              cx="24"
              cy="52"
              rx="5"
              ry="8"
              className="fill-orange-500 flame-main"
            />
            
            {/* Flame - Inner */}
            <ellipse
              cx="24"
              cy="50"
              rx="3"
              ry="5"
              className="fill-yellow-400 flame-inner"
            />
            
            {/* Flame - Core */}
            <ellipse
              cx="24"
              cy="48"
              rx="1.5"
              ry="3"
              className="fill-white/90"
            />
          </svg>
        </div>
        
        {showText && (
          <p className="text-sm text-muted-foreground font-medium rocket-loading-text">
            {message}
          </p>
        )}
      </div>
    );
  }
);

RocketLoader.displayName = "RocketLoader";
