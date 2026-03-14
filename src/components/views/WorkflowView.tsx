"use client";

import { useCallback, useState } from "react";
import { useEngineGet, engineFetch } from "@/lib/useEngine";
import { StatusBadge } from "@/components/widgets/StatusBadge";
import { DetailCard } from "@/components/widgets/DetailCard";

export interface WorkflowAction {
  label: string;
  endpoint: string; // e.g. "/experiments/drafts/{id}/approve"
  method?: string;
  variant: "primary" | "accent" | "ghost";
  confirmMessage?: string;
  needsReason?: boolean;
}

export interface WorkflowConfig {
  listEndpoint: string;
  listKey: string;
  idField?: string;
  statusField?: string;
  titleField?: string;
  filters: string[]; // e.g. ["all", "pending", "approved", "rejected"]
  actions: WorkflowAction[];
  detailEndpoint?: string;
}

export function WorkflowView({ config }: { config: WorkflowConfig }) {
  const {
    listEndpoint, listKey, idField = "draft_id", statusField = "status",
    titleField, filters, actions: actionDefs, detailEndpoint,
  } = config;

  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const queryParam = activeFilter !== "all" ? `?status=${activeFilter}` : "";
  const { data: listData, loading, refetch } = useEngineGet<Record<string, unknown>>(listEndpoint + queryParam);

  const items = (listData?.[listKey] as Record<string, unknown>[]) || [];

  const runAction = useCallback(async (action: WorkflowAction, itemId: string, reason?: string) => {
    setActionLoading(`${action.label}-${itemId}`);
    try {
      const path = action.endpoint.replace("{id}", itemId);
      const body = reason ? { reason } : {};
      await engineFetch(path, { method: action.method || "POST", body: JSON.stringify(body) });
      refetch();
      setExpandedId(null);
      setRejectId(null);
      setRejectReason("");
    } catch { /* silent */ }
    setActionLoading(null);
  }, [refetch]);

  async function loadDetail(itemId: string) {
    if (!detailEndpoint) return;
    try {
      const res = await engineFetch<Record<string, unknown>>(detailEndpoint.replace("{id}", itemId));
      const keys = Object.keys(res).filter((k) => k !== "ok");
      setDetail(keys.length === 1 ? (res[keys[0]] as Record<string, unknown>) : res);
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => { setActiveFilter(f); setExpandedId(null); }}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all"
            style={{
              background: activeFilter === f ? "var(--hc-primary)" : "var(--hc-bg-soft)",
              color: activeFilter === f ? "#fff" : "var(--hc-text-muted)",
              border: `1px solid ${activeFilter === f ? "var(--hc-primary)" : "var(--hc-border)"}`,
            }}
          >
            {f}
          </button>
        ))}
        <button onClick={refetch} className="hc-btn hc-btn-ghost text-xs ml-auto">Reload</button>
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg" style={{ background: "var(--hc-bg-soft)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center" style={{ color: "var(--hc-text-muted)" }}>
          <p className="text-sm">No items with status &ldquo;{activeFilter}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const id = String(item[idField] ?? "");
            const status = String(item[statusField] ?? "unknown");
            const title = titleField ? String(item[titleField] ?? id) : id;
            const isExpanded = expandedId === id;

            return (
              <div
                key={id}
                className="rounded-lg transition-shadow"
                style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)" }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => { setExpandedId(isExpanded ? null : id); if (!isExpanded) loadDetail(id); }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--hc-heading)" }}>{title}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      ID: {id}
                      {item.created_at && <span className="ml-3">{new Date(String(item.created_at)).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms", color: "var(--hc-text-muted)" }}
                  >
                    <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="space-y-3 px-4 pb-4" style={{ borderTop: "1px solid var(--hc-border)" }}>
                    {/* Detail */}
                    {detail && <div className="pt-3"><DetailCard data={detail} /></div>}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {actionDefs.map((action) => {
                        const isReject = action.needsReason;
                        if (isReject && rejectId === id) {
                          return (
                            <div key={action.label} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Reason for rejection…"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="rounded px-2 py-1 text-xs"
                                style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                              />
                              <button
                                className="hc-btn hc-btn-accent text-xs"
                                onClick={() => runAction(action, id, rejectReason)}
                                disabled={actionLoading === `${action.label}-${id}`}
                              >
                                Confirm
                              </button>
                              <button className="hc-btn hc-btn-ghost text-xs" onClick={() => setRejectId(null)}>Cancel</button>
                            </div>
                          );
                        }
                        const cls = action.variant === "primary" ? "hc-btn hc-btn-primary" : action.variant === "accent" ? "hc-btn hc-btn-accent" : "hc-btn hc-btn-ghost";
                        return (
                          <button
                            key={action.label}
                            className={`${cls} text-xs`}
                            disabled={actionLoading === `${action.label}-${id}`}
                            onClick={() => {
                              if (action.needsReason) { setRejectId(id); return; }
                              if (action.confirmMessage && !confirm(action.confirmMessage)) return;
                              runAction(action, id);
                            }}
                          >
                            {actionLoading === `${action.label}-${id}` && (
                              <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
