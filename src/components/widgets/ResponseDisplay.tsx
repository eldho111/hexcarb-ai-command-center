"use client";

import { DataTable, type ColumnDef } from "./DataTable";
import { DetailCard } from "./DetailCard";

export function ResponseDisplay({
  data,
  mode = "auto",
}: {
  data: unknown;
  mode?: "json" | "text" | "table" | "auto";
}) {
  if (data === null || data === undefined) return null;

  const effectiveMode = mode === "auto" ? detectMode(data) : mode;

  if (effectiveMode === "table" && Array.isArray(data) && data.length > 0) {
    const sample = data[0] as Record<string, unknown>;
    const columns: ColumnDef[] = Object.keys(sample)
      .filter((k) => k !== "ok")
      .slice(0, 8)
      .map((k) => ({ key: k, label: k.replace(/_/g, " ") }));
    return <DataTable columns={columns} data={data as Record<string, unknown>[]} />;
  }

  if (effectiveMode === "text" && typeof data === "string") {
    return (
      <div
        className="whitespace-pre-wrap rounded-lg p-4 text-sm"
        style={{ background: "var(--hc-bg-soft)", color: "var(--hc-text)", border: "1px solid var(--hc-border)" }}
      >
        {data}
      </div>
    );
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    // Strip the "ok" field
    const clean = Object.fromEntries(Object.entries(obj).filter(([k]) => k !== "ok"));
    // If it has a single nested key that is an object, show that
    const keys = Object.keys(clean);
    if (keys.length === 1 && typeof clean[keys[0]] === "object" && clean[keys[0]] !== null && !Array.isArray(clean[keys[0]])) {
      return <DetailCard title={keys[0].replace(/_/g, " ")} data={clean[keys[0]] as Record<string, unknown>} />;
    }
    return <DetailCard data={clean} />;
  }

  // Fallback: JSON
  return (
    <pre
      className="max-h-96 overflow-auto rounded-lg p-4 text-xs font-mono"
      style={{ background: "var(--hc-bg-soft)", color: "var(--hc-text)", border: "1px solid var(--hc-border)" }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function detectMode(data: unknown): "table" | "text" | "json" {
  if (typeof data === "string") return "text";
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") return "table";
  return "json";
}
