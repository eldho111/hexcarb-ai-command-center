"use client";

import { useCallback, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";

export interface ColumnDef {
  key: string;
  label: string;
  width?: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

function defaultRender(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="opacity-40">—</span>;
  if (typeof value === "boolean") return <StatusBadge status={value ? "true" : "false"} />;
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.slice(0, 4).map((v, i) => (
            <span key={i} className="rounded bg-black/[.05] px-1.5 py-0.5 text-[10px]">{String(v)}</span>
          ))}
          {value.length > 4 && <span className="text-[10px] opacity-50">+{value.length - 4}</span>}
        </span>
      );
    }
    return <span className="font-mono text-[10px] opacity-60">{JSON.stringify(value).slice(0, 60)}</span>;
  }
  const s = String(value);
  // Detect status-like strings
  if (/^(ok|done|completed|approved|pending|open|rejected|failed|error|idle|running|active|draft)$/i.test(s)) {
    return <StatusBadge status={s} />;
  }
  return <span className="truncate">{s.length > 80 ? s.slice(0, 80) + "…" : s}</span>;
}

export function DataTable({
  columns,
  data,
  onRowClick,
  loading,
  emptyMessage,
  selectedId,
  idField = "id",
}: {
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  loading?: boolean;
  emptyMessage?: string;
  selectedId?: string | null;
  idField?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const sa = av == null ? "" : String(av);
      const sb = bv == null ? "" : String(bv);
      const cmp = sa.localeCompare(sb, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded" style={{ background: "var(--hc-bg-soft)" }} />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="16" rx="3" stroke="var(--hc-border)" strokeWidth="1.5" />
          <line x1="4" y1="14" x2="28" y2="14" stroke="var(--hc-border)" strokeWidth="1.5" />
        </svg>
        <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
          {emptyMessage || "No data yet. Use the actions above to get started."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ color: "var(--hc-text)" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--hc-border)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80"
                style={{ color: "var(--hc-text-muted)", width: col.width }}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => {
            const rowId = String(row[idField] ?? ri);
            const isSelected = selectedId != null && rowId === selectedId;
            return (
              <tr
                key={rowId}
                onClick={() => onRowClick?.(row)}
                className="transition-colors"
                style={{
                  cursor: onRowClick ? "pointer" : "default",
                  borderBottom: "1px solid var(--hc-border)",
                  background: isSelected ? "rgba(142,106,53,0.08)" : undefined,
                }}
                onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = "var(--hc-bg-soft)"); }}
                onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = ""); }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2.5" style={{ maxWidth: col.width || "200px" }}>
                    {col.render ? col.render(row[col.key], row) : defaultRender(row[col.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
