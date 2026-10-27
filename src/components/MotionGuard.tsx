"use client";

import { useEffect } from "react";

// Met en pause les animations SVG (illustrations des agents) si l'utilisateur
// a demandé à réduire les animations dans son système.
export function MotionGuard() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pause = () => document.querySelectorAll<SVGSVGElement>("svg[data-animated]").forEach((svg) => svg.pauseAnimations?.());
    pause();
    const observer = new MutationObserver(pause);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
