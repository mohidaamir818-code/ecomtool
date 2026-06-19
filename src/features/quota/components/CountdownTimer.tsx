"use client";

import { useEffect, useState } from "react";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

export function CountdownTimer({ resetsAt }: { resetsAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      setRemaining(new Date(resetsAt).getTime() - Date.now());
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resetsAt]);

  return (
    <span className="font-mono text-sm tabular-nums">{formatCountdown(remaining)}</span>
  );
}
