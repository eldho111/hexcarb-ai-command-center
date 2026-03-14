"use client";

import React, { useState } from "react";
import { StatusBadge } from "./StatusBadge";

export interface FieldDef {
  key: string;
  label: string;
}

function formatValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="opacity-40">—</span>;
  if (typeof value === "boolean") return <StatusBadge status={value ? "true" : "false"} />;
  if (typeof value === "number") return <span className="font-mono">{value}</span>;
  if (typeof value === "string") {
    if (/^(ok|done|completed|approved|pending|open|rejected|failed|error|idle|running|active|draft)$/i.test(value)) {
      return <StatusBadge status={value} />;
    }
    // ISO date detection
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(value)) {
      try {
        return <span className="font-mono text-xs">{new Date(value).toLocaleString()}</span>;
      } catch { /* fall through */ }
    }
    return <span>{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded px-1.5 py-0.5 text-xs" style={{ background: "var(--hc-bg-soft)" }}>
            {String(v)}
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="max-h-40 overflow-auto rounded p-2 text-xs font-mono" style={{ background: "var(--hc-bg-soft)" }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

export function DetailCard({
  title,
  data,
  fields,
}: {
  title?: string;
  data: Record<string, unknown>;
  fields?: FieldDef[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const entries = fields
    ? fields.map((f) => ({ key: f.key, label: f.label, value: data[f.key] }))
    : Object.entries(data)
        .filter(([k]) => k !== "ok")
        .map(([k, v]) => ({ key: k, label: k.replace(/_/g, " "), value: v }));

  function copyValue(key: string, value: unknown) {
    const text = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div
      className="rounded-lg"
      style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)" }}
    >
      {title && (
        <div
          className="px-4 py-3 text-sm font-semibold"
          style={{ borderBottom: "1px solid var(--hc-border)", color: "var(--hc-heading)" }}
        >
          {title}
        </div>
      )}
      <div className="divide-y" style={{ borderColor: "var(--hc-border)" }}>
        {entries.map((e) => (
          <div key={e.key} className="group flex items-start gap-3 px-4 py-2.5">
            <div
              className="w-36 shrink-0 pt-0.5 text-xs font-medium capitalize"
              style={{ color: "var(--hc-text-muted)" }}
            >
              {e.label}
            </div>
            <div className="min-w-0 flex-1 text-sm" style={{ color: "var(--hc-text)" }}>
              {formatValue(e.value)}
            </div>
            <button
              onClick={() => copyValue(e.key, e.value)}
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
              title="Copy"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10 4V3C10 2.45 9.55 2 9 2H3C2.45 2 2 2.45 2 3V9C2 9.55 2.45 10 3 10H4" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {copied === e.key && (
                <span className="absolute -mt-6 ml-2 rounded bg-black px-1 py-0.5 text-[10px] text-white">
                  Copied
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
