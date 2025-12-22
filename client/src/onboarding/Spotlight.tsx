import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  targetSelector?: string;
  isActive: boolean;
  children?: React.ReactNode;
  onClickOutside?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Spotlight({ targetSelector, isActive, children, onClickOutside }: SpotlightProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!isActive || !targetSelector) {
      setTargetRect(null);
      setIsReady(false);
      return;
    }

    const findAndMeasureTarget = () => {
      const selectors = targetSelector.split(",").map((s) => s.trim());
      let element: Element | null = null;

      for (const selector of selectors) {
        element = document.querySelector(selector);
        if (element) break;
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = 8;
        setTargetRect({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
        setIsReady(true);

        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        observerRef.current = new ResizeObserver(() => {
          const newRect = element!.getBoundingClientRect();
          setTargetRect({
            top: newRect.top - padding,
            left: newRect.left - padding,
            width: newRect.width + padding * 2,
            height: newRect.height + padding * 2,
          });
        });
        observerRef.current.observe(element);
      } else {
        setTargetRect(null);
        setIsReady(false);
      }
    };

    findAndMeasureTarget();
    const interval = setInterval(findAndMeasureTarget, 500);

    return () => {
      clearInterval(interval);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [targetSelector, isActive]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9998] pointer-events-none transition-opacity duration-300",
        isReady ? "opacity-100" : "opacity-0"
      )}
      data-testid="spotlight-overlay"
    >
      {targetRect ? (
        <>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ minHeight: "100vh" }}
          >
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left}
                  y={targetRect.top}
                  width={targetRect.width}
                  height={targetRect.height}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#spotlight-mask)"
            />
          </svg>
          {/* Clickable overlay areas around the spotlight */}
          {onClickOutside && (
            <>
              {/* Top area */}
              <div
                className="absolute left-0 right-0 cursor-pointer pointer-events-auto"
                style={{ top: 0, height: Math.max(0, targetRect.top) }}
                onClick={onClickOutside}
              />
              {/* Bottom area */}
              <div
                className="absolute left-0 right-0 cursor-pointer pointer-events-auto"
                style={{ top: targetRect.top + targetRect.height, bottom: 0 }}
                onClick={onClickOutside}
              />
              {/* Left area */}
              <div
                className="absolute cursor-pointer pointer-events-auto"
                style={{
                  top: targetRect.top,
                  left: 0,
                  width: Math.max(0, targetRect.left),
                  height: targetRect.height,
                }}
                onClick={onClickOutside}
              />
              {/* Right area */}
              <div
                className="absolute cursor-pointer pointer-events-auto"
                style={{
                  top: targetRect.top,
                  left: targetRect.left + targetRect.width,
                  right: 0,
                  height: targetRect.height,
                }}
                onClick={onClickOutside}
              />
            </>
          )}
        </>
      ) : (
        <div 
          className={cn(
            "absolute inset-0 bg-black/60", 
            onClickOutside && "cursor-pointer pointer-events-auto"
          )} 
          onClick={onClickOutside}
        />
      )}
      {children}
    </div>
  );
}
