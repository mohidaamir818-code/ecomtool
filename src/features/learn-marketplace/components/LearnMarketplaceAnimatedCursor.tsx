"use client";

import { useEffect, useState, type RefObject } from "react";

interface LearnMarketplaceAnimatedCursorProps {
  targetRef: RefObject<HTMLElement | null>;
  visible: boolean;
}

export function LearnMarketplaceAnimatedCursor({
  targetRef,
  visible,
}: LearnMarketplaceAnimatedCursorProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!visible) return;

    function updatePosition() {
      const target = targetRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width * 0.55,
        y: rect.top + rect.height * 0.75,
      });
    }

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [targetRef, visible]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-[80]"
      style={{ left: position.x, top: position.y }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9 drop-shadow-md animate-[learn-cursor-wiggle_0.9s_ease-in-out_infinite]"
        fill="#3665f3"
      >
        <path d="M5.5 3.5l12 8.5-5.2 1.2-2.3 5.8z" stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
}
