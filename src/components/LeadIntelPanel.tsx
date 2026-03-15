"use client";

import { useEffect, useState } from "react";

type LeadSignal = string[] | string | null;

type LeadStatus = {
  ok: boolean;
  available: boolean;
  source_path: string;
  exported_at?: string | null;
  row_count: number;
  focus: string;
  warning?: string | null;
};

type LeadRow = {
  name: string | null;
  org: string | null;
  country: string | null;
  state: string | null;
  kerala_flag: boolean;
  lead_score: number;
  top_keywords: LeadSignal;
  top_applications: LeadSignal;
  last_active_year: string | null;
  top_works: LeadSignal;
  top_patents: LeadSignal;
  swcnt_match: boolean;
};

type LeadFilters = {
  focus: "swcnt" | "all";
  minScore: string;
  keralaOnly: boolean;
  indiaOnly: boolean;
};

const DEFAULT_FILTERS: LeadFilters = {
  focus: "swcnt",
  minScore: "",
  keralaOnly: false,
  indiaOnly: false,
};

const MANUAL_EXPORT_COMMAND =
  "python -m cnt_lead_intel.cli export --format csv --out data/exports/leads.csv";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asSignal(value: unknown): LeadSignal {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim());
  }
  if (typeof value === "string") {
    return value.trim() ? value : null;
  }
  return null;
}

function normalizeStatus(value: unknown): LeadStatus | null {
  if (!isRecord(value)) return null;
  return {
    ok: value.ok !== false,
    available: value.available === true,
    source_path: String(value.source_path || ""),
    exported_at: asString(value.exported_at),
    row_count: asNumber(value.row_count),
    focus: String(value.focus || "swcnt"),
    warning: asString(value.warning),
  };
}

function normalizeRows(value: unknown): LeadRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      name: asString(row.name),
      org: asString(row.org),
      country: asString(row.country),
      state: asString(row.state),
      kerala_flag: asBoolean(row.kerala_flag),
      lead_score: asNumber(row.lead_score),
      top_keywords: asSignal(row.top_keywords),
      top_applications: asSignal(row.top_applications),
      last_active_year: asString(row.last_active_year),
      top_works: asSignal(row.top_works),
      top_patents: asSignal(row.top_patents),
      swcnt_match: asBoolean(row.swcnt_match),
    }));
}

async function readError(resp: Response): Promise<string> {
  try {
    const payload = (await resp.json()) as unknown;
    if (isRecord(payload)) {
      return String(payload.error || payload.message || `HTTP ${resp.status}`);
    }
  } catch {
    // ignore JSON parsing failures here
  }
  return `HTTP ${resp.status}`;
}

function formatSignal(value: LeadSignal): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "-";
  return value || "-";
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatLocation(row: LeadRow): string {
  const parts = [row.state, row.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatExportedAt(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function LeadIntelPanel() {
  const [draftFilters, setDraftFilters] = useState<LeadFilters>({ ...DEFAULT_FILTERS });
  const [filters, setFilters] = useState<LeadFilters>({ ...DEFAULT_FILTERS });
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();

    async function load(): Promise<void> {
      setLoading(true);
      setError("");

      const statusResp = await fetch("/api/engine/lead_intel/status", {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!statusResp.ok) {
        setError(await readError(statusResp));
        setLoading(false);
        return;
      }

      const statusPayload = normalizeStatus((await statusResp.json()) as unknown);
      if (!statusPayload) {
        setError("Unexpected lead status response.");
        setLoading(false);
        return;
      }

      setStatus(statusPayload);
      if (!statusPayload.available) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const query = new URLSearchParams();
      query.set("focus", filters.focus);
      query.set("limit", "25");
      if (filters.minScore.trim()) query.set("min_score", filters.minScore.trim());
      if (filters.keralaOnly) query.set("kerala_only", "true");
      if (filters.indiaOnly) query.set("india_only", "true");

      const leadsResp = await fetch(`/api/engine/lead_intel/leads?${query.toString()}`, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!leadsResp.ok) {
        setError(await readError(leadsResp));
        setLoading(false);
        return;
      }

      const payload = (await leadsResp.json()) as unknown;
      if (!isRecord(payload)) {
        setError("Unexpected lead list response.");
        setLoading(false);
        return;
      }
      if (payload.ok === false) {
        setError(String(payload.error || payload.message || "lead_intel_error"));
        setLoading(false);
        return;
      }

      setRows(normalizeRows(payload.rows));
      setTotal(asNumber(payload.total));
      setLoading(false);
    }

    load().catch((err: unknown) => {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => abort.abort();
  }, [filters]);

  function applyFilters() {
    setFilters({ ...draftFilters });
  }

  function resetFilters() {
    setDraftFilters({ ...DEFAULT_FILTERS });
    setFilters({ ...DEFAULT_FILTERS });
  }

  return (
    <section className="hex-card overflow-hidden">
      <div className="border-b border-[var(--hex-border)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">SWCNT Lead Intel</div>
            <div className="text-xs text-[var(--hex-ink-soft)]">
              Read-only lead intelligence backed by the current export. This
              panel defaults to <span className="font-mono">SWCNT-first</span>{" "}
              ranking while keeping broader CNT leads visible.
            </div>
          </div>
          <span className="hex-pill border-emerald-200 bg-emerald-50 text-emerald-900">
            read-only
          </span>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-[var(--hex-border)] bg-[var(--hex-surface)] px-4 py-3 text-sm text-[var(--hex-ink-soft)]">
            Loading lead export status and SWCNT-first results...
          </div>
        ) : null}

        {status ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="hex-card-muted px-4 py-3">
              <div className="text-xs text-[var(--hex-ink-soft)]">Export</div>
              <div className="mt-1 text-sm font-semibold">
                {status.available ? "Available" : "Missing"}
              </div>
            </div>
            <div className="hex-card-muted px-4 py-3">
              <div className="text-xs text-[var(--hex-ink-soft)]">Rows</div>
              <div className="mt-1 text-sm font-semibold">{status.row_count}</div>
            </div>
            <div className="hex-card-muted px-4 py-3">
              <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
              <div className="mt-1 text-sm font-semibold">SWCNT-first</div>
            </div>
            <div className="hex-card-muted px-4 py-3">
              <div className="text-xs text-[var(--hex-ink-soft)]">Exported</div>
              <div className="mt-1 text-sm font-semibold">
                {formatExportedAt(status.exported_at)}
              </div>
            </div>
          </div>
        ) : null}

        {status?.source_path ? (
          <div className="mt-3 text-xs text-[var(--hex-ink-soft)]">
            Source export: <span className="font-mono">{status.source_path}</span>
          </div>
        ) : null}

        {status?.warning ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div>{status.warning}</div>
            {!status.available ? (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-[0.2em] text-amber-700">
                  Manual export command
                </div>
                <code className="mt-2 block rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-amber-950">
                  {MANUAL_EXPORT_COMMAND}
                </code>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {status?.available ? (
        <div className="space-y-5 px-5 py-5">
          <div className="rounded-2xl border border-[var(--hex-border)] bg-[var(--hex-surface)] p-4">
            <div className="flex flex-wrap items-end gap-4">
              <label className="min-w-[180px] flex-1">
                <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
                <select
                  className="hex-input mt-2 w-full"
                  value={draftFilters.focus}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      focus: e.target.value === "all" ? "all" : "swcnt",
                    }))
                  }
                >
                  <option value="swcnt">SWCNT-first</option>
                  <option value="all">All CNT leads</option>
                </select>
              </label>

              <label className="min-w-[180px] flex-1">
                <div className="text-xs text-[var(--hex-ink-soft)]">Min score</div>
                <input
                  className="hex-input mt-2 w-full"
                  inputMode="decimal"
                  placeholder="0"
                  value={draftFilters.minScore}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, minScore: e.target.value }))
                  }
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--hex-ink-muted)]">
                <input
                  type="checkbox"
                  checked={draftFilters.keralaOnly}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      keralaOnly: e.target.checked,
                    }))
                  }
                />
                Kerala only
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--hex-ink-muted)]">
                <input
                  type="checkbox"
                  checked={draftFilters.indiaOnly}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      indiaOnly: e.target.checked,
                    }))
                  }
                />
                India only
              </label>

              <div className="flex items-center gap-2">
                <button type="button" className="hex-button" onClick={applyFilters}>
                  Apply filters
                </button>
                <button
                  type="button"
                  className="hex-button-outline"
                  onClick={resetFilters}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--hex-ink-muted)]">
            <div>
              Showing {rows.length} of {total} lead candidates.
            </div>
            <div className="hex-pill">Focus: {filters.focus === "swcnt" ? "SWCNT-first" : "All CNT leads"}</div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--hex-border)] bg-[var(--hex-surface)] px-4 py-4 text-sm text-[var(--hex-ink-muted)]">
              No leads matched the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--hex-border)] bg-white">
              <table className="min-w-full divide-y divide-[var(--hex-border)] text-sm">
                <thead className="bg-[var(--hex-surface)] text-left text-xs uppercase tracking-[0.16em] text-[var(--hex-ink-soft)]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Org</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">SWCNT</th>
                    <th className="px-4 py-3">Signals</th>
                    <th className="px-4 py-3">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hex-border)]">
                  {rows.map((row, index) => (
                    <tr key={`${row.name || "lead"}-${index}`} className="align-top">
                      <td className="px-4 py-3 font-semibold text-[var(--hex-ink)]">
                        {row.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--hex-ink-muted)]">
                        {row.org || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--hex-ink-muted)]">
                        <div>{formatLocation(row)}</div>
                        <div className="mt-1 text-xs text-[var(--hex-ink-soft)]">
                          Kerala flag: {row.kerala_flag ? "yes" : "no"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--hex-ink)]">
                        {formatScore(row.lead_score)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`hex-pill ${
                            row.swcnt_match
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-[var(--hex-border)] text-[var(--hex-ink-muted)]"
                          }`}
                        >
                          {row.swcnt_match ? "match" : "other"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--hex-ink-muted)]">
                        <div><span className="font-semibold text-[var(--hex-ink-soft)]">Keywords:</span> {formatSignal(row.top_keywords)}</div>
                        <div className="mt-1"><span className="font-semibold text-[var(--hex-ink-soft)]">Apps:</span> {formatSignal(row.top_applications)}</div>
                        <div className="mt-1"><span className="font-semibold text-[var(--hex-ink-soft)]">Works:</span> {formatSignal(row.top_works)}</div>
                        <div className="mt-1"><span className="font-semibold text-[var(--hex-ink-soft)]">Patents:</span> {formatSignal(row.top_patents)}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--hex-ink-muted)]">
                        {row.last_active_year || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
