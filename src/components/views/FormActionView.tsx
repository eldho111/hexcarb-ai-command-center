"use client";

import { useCallback, useMemo, useState } from "react";
import { engineFetch } from "@/lib/useEngine";
import { FormPanel, type FormFieldDef } from "@/components/widgets/FormPanel";
import { ResponseDisplay } from "@/components/widgets/ResponseDisplay";

export interface FormActionConfig {
  submitEndpoint: string;
  submitMethod?: "POST" | "GET";
  fields: FormFieldDef[];
  submitLabel?: string;
  responseMode?: "json" | "text" | "table" | "auto";
  wrapKey?: string;
}

interface HistoryEntry {
  id: number;
  input: Record<string, unknown>;
  output: unknown;
  ts: number;
}

function isAiWorkflow(path: string): boolean {
  return path === "/chat" || path.startsWith("/reasoning") || path.startsWith("/narratives");
}

function saveWorkspaceArtifact(args: {
  panelId?: string;
  panelLabel?: string;
  workspaceId?: string;
  endpoint: string;
  output: unknown;
}) {
  if (typeof window === "undefined") return;
  const key = "hc-workspace-saves";
  const existing = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<Record<string, unknown>>;
  const next = [
    {
      id: `save_${Date.now()}`,
      panelId: args.panelId || "panel",
      panelLabel: args.panelLabel || "Saved result",
      workspaceId: args.workspaceId || null,
      endpoint: args.endpoint,
      savedAt: new Date().toISOString(),
      output: args.output,
    },
    ...existing,
  ].slice(0, 20);
  window.localStorage.setItem(key, JSON.stringify(next));
}

export function FormActionView({
  config,
  panelId,
  panelLabel,
  workspaceId,
}: {
  config: FormActionConfig;
  panelId?: string;
  panelLabel?: string;
  workspaceId?: string;
}) {
  const { submitEndpoint, submitMethod = "POST", fields, submitLabel, responseMode = "auto", wrapKey } = config;

  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saved, setSaved] = useState(false);

  const aiDriven = useMemo(() => isAiWorkflow(submitEndpoint), [submitEndpoint]);

  const handleSubmit = useCallback(async (formData: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const body = wrapKey ? { [wrapKey]: formData } : formData;
      const res = await engineFetch<Record<string, unknown>>(submitEndpoint, {
        method: submitMethod,
        body: JSON.stringify(body),
      });
      const clean = Object.fromEntries(Object.entries(res).filter(([k]) => k !== "ok"));
      const keys = Object.keys(clean);
      const display = keys.length === 1 ? clean[keys[0]] : clean;
      setResult(display);
      setHistory((prev) => [
        { id: Date.now(), input: formData, output: display, ts: Date.now() },
        ...prev.slice(0, 4),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [submitEndpoint, submitMethod, wrapKey]);

  const saveResult = useCallback(() => {
    if (result == null) return;
    saveWorkspaceArtifact({
      panelId,
      panelLabel,
      workspaceId,
      endpoint: submitEndpoint,
      output: result,
    });
    setSaved(true);
  }, [panelId, panelLabel, result, submitEndpoint, workspaceId]);

  return (
    <div className="space-y-5">
      <div className="hc-card p-5">
        <FormPanel
          fields={fields}
          onSubmit={handleSubmit}
          submitLabel={submitLabel || "Run"}
          loading={loading}
        />
      </div>

      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: "rgba(245,100,84,0.08)", border: "1px solid var(--hc-active)", color: "var(--hc-active)" }}
        >
          {error}
        </div>
      )}

      {result !== null ? (
        <div className="hc-card overflow-hidden p-0">
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--hc-border)", background: "var(--hc-surface-chip)" }}
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
                Result
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    background: aiDriven ? "rgba(78,124,116,0.12)" : "var(--hc-surface-muted)",
                    color: aiDriven ? "var(--hc-green)" : "var(--hc-text-muted)",
                    border: `1px solid ${aiDriven ? "rgba(78,124,116,0.24)" : "var(--hc-surface-muted-border)"}`,
                  }}
                >
                  {aiDriven ? "AI-generated" : "Native output"}
                </span>
                <span className="text-[11px] font-medium" style={{ color: "var(--hc-text-muted)" }}>
                  {submitEndpoint}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                {aiDriven
                  ? "This output came from an assistant-driven workflow. Review it before acting, and use Save To Workspace if you want to keep it in the shared context rail."
                  : "This result came from a dedicated engine workflow rather than the general assistant."}
              </p>
            </div>
            {aiDriven ? (
              <button type="button" className="hc-btn hc-btn-ghost text-xs" onClick={saveResult}>
                {saved ? "Saved" : "Save To Workspace"}
              </button>
            ) : null}
          </div>
          <div className="p-4">
            <ResponseDisplay data={result} mode={responseMode} />
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "var(--hc-text-muted)" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ transform: showHistory ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}
            >
              <path d="M4 2.5L8 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recent History ({history.length})
          </button>
          {showHistory ? (
            <div className="mt-2 space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-lg p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--hc-text-muted)" }}>
                    <span>Input: {JSON.stringify(entry.input).slice(0, 80)}</span>
                    <span>{new Date(entry.ts).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1">
                    <ResponseDisplay data={entry.output} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
