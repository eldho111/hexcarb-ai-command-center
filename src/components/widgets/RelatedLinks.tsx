"use client";

import Link from "next/link";

export interface RelatedLinkDef {
  panelId: string;
  label: string;
  description?: string;
}

export function RelatedLinks({ links }: { links: RelatedLinkDef[] }) {
  if (!links.length) return null;
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
        Related Panels
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.panelId}
            href={`/panel/${l.panelId}`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
            style={{
              background: "var(--hc-card-bg)",
              border: "1px solid var(--hc-border)",
              color: "var(--hc-accent)",
            }}
            title={l.description}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M5 3L8 6L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
