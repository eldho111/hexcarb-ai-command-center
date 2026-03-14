"use client";

import { useEngineGet } from "@/lib/useEngine";
import { StatusBadge } from "@/components/widgets/StatusBadge";
import { ActionBar, type ActionDef } from "@/components/widgets/ActionBar";

export interface MetricDef {
  key: string;
  label: string;
  format?: "number" | "bytes" | "percent" | "status" | "auto";
}

export interface DashboardEndpoint {
  key: string;
  endpoint: string;
  label: string;
  metrics?: MetricDef[];
}

export interface DashboardConfig {
  endpoints: DashboardEndpoint[];
  refreshInterval?: number;
  actions?: { label: string; endpoint: string; method?: string }[];
}

function formatMetricValue(value: unknown, format?: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="opacity-40">—</span>;
  if (typeof value === "boolean") return <StatusBadge status={value ? "ok" : "error"} />;
  if (format === "status" || (typeof value === "string" && /^(ok|error|idle|running|completed|pending|down|healthy)$/i.test(value))) {
    return <StatusBadge status={String(value)} />;
  }
  if (format === "percent" && typeof value === "number") return <span className="font-mono">{value.toFixed(1)}%</span>;
  if (format === "bytes" && typeof value === "number") {
    if (value > 1024 * 1024 * 1024) return <span className="font-mono">{(value / 1024 / 1024 / 1024).toFixed(1)} GB</span>;
    if (value > 1024 * 1024) return <span className="font-mono">{(value / 1024 / 1024).toFixed(1)} MB</span>;
    return <span className="font-mono">{value}</span>;
  }
  if (typeof value === "number") return <span className="font-mono">{Number.isInteger(value) ? value : value.toFixed(2)}</span>;
  if (typeof value === "object") {
    if (Array.isArray(value)) return <span className="font-mono text-xs">{value.length} items</span>;
    return <span className="text-xs opacity-60">[object]</span>;
  }
  return <span>{String(value)}</span>;
}

function MetricCard({ label, value, format }: { label: string; value: unknown; format?: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)" }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
        {formatMetricValue(value, format)}
      </div>
    </div>
  );
}

function EndpointSection({ ep, refreshInterval }: { ep: DashboardEndpoint; refreshInterval?: number }) {
  const { data, loading, error } = useEngineGet<Record<string, unknown>>(ep.endpoint, refreshInterval);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>{ep.label}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg" style={{ background: "var(--hc-bg-soft)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: "rgba(245,100,84,0.08)", border: "1px solid var(--hc-active)" }}>
        <div className="text-xs font-semibold" style={{ color: "var(--hc-active)" }}>{ep.label}: Error</div>
        <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // If specific metrics are defined, show only those
  if (ep.metrics && ep.metrics.length > 0) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>{ep.label}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ep.metrics.map((m) => {
            // Support nested keys like "memory.total_gb"
            const value = m.key.split(".").reduce<unknown>((obj, k) => (obj && typeof obj === "object" ? (obj as Record<string, unknown>)[k] : undefined), data);
            return <MetricCard key={m.key} label={m.label} value={value} format={m.format} />;
          })}
        </div>
      </div>
    );
  }

  // Auto-generate from response data
  const entries = Object.entries(data).filter(([k]) => k !== "ok");
  // Separate scalar vs object values
  const scalars = entries.filter(([, v]) => typeof v !== "object" || v === null);
  const objects = entries.filter(([, v]) => typeof v === "object" && v !== null && !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>{ep.label}</div>
      {scalars.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scalars.map(([k, v]) => (
            <MetricCard key={k} label={k.replace(/_/g, " ")} value={v} />
          ))}
        </div>
      )}
      {objects.map(([k, v]) => (
        <div key={k} className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--hc-accent)" }}>
            {k.replace(/_/g, " ")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(v as Record<string, unknown>).filter(([sk]) => typeof (v as Record<string, unknown>)[sk] !== "object" || (v as Record<string, unknown>)[sk] === null).map(([sk, sv]) => (
              <MetricCard key={sk} label={sk.replace(/_/g, " ")} value={sv} />
            ))}
          </div>
        </div>
      ))}
      {arrays.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--hc-accent)" }}>
            {k.replace(/_/g, " ")} ({(v as unknown[]).length})
          </div>
          <pre
            className="max-h-48 overflow-auto rounded p-3 text-xs font-mono"
            style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}
          >
            {JSON.stringify(v, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ config }: { config: DashboardConfig }) {
  const interval = config.refreshInterval ?? 15000;

  const actions: ActionDef[] = (config.actions || []).map((a) => ({
    label: a.label,
    variant: "ghost" as const,
    onClick: () => {
      fetch(`/api/engine${a.endpoint}`, {
        method: a.method || "POST",
        headers: { "content-type": "application/json" },
        body: a.method === "GET" ? undefined : "{}",
      });
    },
  }));

  return (
    <div className="space-y-6">
      {actions.length > 0 && <ActionBar actions={actions} />}
      {config.endpoints.map((ep) => (
        <EndpointSection key={ep.key} ep={ep} refreshInterval={interval} />
      ))}
    </div>
  );
}
