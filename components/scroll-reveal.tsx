"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";

export function ScrollReveal({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    element.dataset.revealReady = "true";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target instanceof HTMLElement) entry.target.dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`scroll-reveal ${className}`}>{children}</div>;
}
