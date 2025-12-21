import { useEffect, useState } from "react";

/**
 * SafeAreaTopBar - iOS PWA Safe Area Handler
 * 
 * This component renders a violet bar in the iOS notch/status bar area
 * when running as a standalone PWA. It ensures the PlanBase brand identity
 * is maintained in the safe-area-inset-top zone.
 * 
 * Only renders on mobile standalone mode (iOS PWA).
 */
export function SafeAreaTopBar() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect PWA standalone mode
    const checkStandalone = () => {
      const isIOSStandalone = (navigator as any).standalone === true;
      const isMediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
      
      setIsStandalone(isIOSStandalone || isMediaStandalone || isFullscreen);
    };

    checkStandalone();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = () => checkStandalone();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Only render in standalone mode
  if (!isStandalone) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      style={{
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor: "hsl(var(--primary))",
      }}
      aria-hidden="true"
      data-testid="safe-area-top-bar"
    />
  );
}

/**
 * Hook to detect if running in PWA standalone mode
 */
export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isIOSStandalone = (navigator as any).standalone === true;
      const isMediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
      
      setIsStandalone(isIOSStandalone || isMediaStandalone || isFullscreen);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = () => checkStandalone();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isStandalone;
}
