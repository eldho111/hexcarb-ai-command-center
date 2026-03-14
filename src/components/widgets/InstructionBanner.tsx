"use client";

import { useEffect, useState } from "react";

export function InstructionBanner({
  panelId,
  title,
  instructions,
  tips,
}: {
  panelId: string;
  title?: string;
  instructions: string;
  tips?: string[];
}) {
  const storageKey = `hc-instr-${panelId}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "0") setOpen(false);
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  }

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{
        background: "var(--hc-bg-soft)",
        borderLeft: "3px solid var(--hc-accent)",
        border: "1px solid var(--hc-border)",
        borderLeftWidth: "3px",
        borderLeftColor: "var(--hc-accent)",
      }}
    >
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-black/[.03]"
        style={{ color: "var(--hc-heading)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="7" stroke="var(--hc-accent)" strokeWidth="1.5" />
          <text x="8" y="12" textAnchor="middle" fontSize="10" fill="var(--hc-accent)" fontWeight="600">i</text>
        </svg>
        <span className="flex-1">{title || "How to use this panel"}</span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--hc-text-muted)" }}
        >
          <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 text-sm" style={{ color: "var(--hc-text-muted)" }}>
          <p>{instructions}</p>
          {tips && tips.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {tips.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
