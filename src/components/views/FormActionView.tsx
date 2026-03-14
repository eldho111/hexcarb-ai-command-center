"use client";

import { useCallback, useState } from "react";
import { engineFetch } from "@/lib/useEngine";
import { FormPanel, type FormFieldDef } from "@/components/widgets/FormPanel";
import { ResponseDisplay } from "@/components/widgets/ResponseDisplay";

export interface FormActionConfig {
  submitEndpoint: string;
  submitMethod?: "POST" | "GET";
  fields: FormFieldDef[];
  submitLabel?: string;
  responseMode?: "json" | "text" | "table" | "auto";
  wrapKey?: string; // Wrap form data under this key, e.g. "experiment" -> { experiment: formData }
}

interface HistoryEntry {
  id: number;
  input: Record<string, unknown>;
  output: unknown;
  ts: number;
}

export function FormActionView({ config }: { config: FormActionConfig }) {
  const { submitEndpoint, submitMethod = "POST", fields, submitLabel, responseMode = "auto", wrapKey } = config;

  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = useCallback(async (formData: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = wrapKey ? { [wrapKey]: formData } : formData;
      const res = await engineFetch<Record<string, unknown>>(submitEndpoint, {
        method: submitMethod,
        body: JSON.stringify(body),
      });
      // Strip "ok" from response
      const clean = Object.fromEntries(Object.entries(res).filter(([k]) => k !== "ok"));
      // Unwrap if single key
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

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="hc-card p-5">
        <FormPanel
          fields={fields}
          onSubmit={handleSubmit}
          submitLabel={submitLabel || "Run"}
          loading={loading}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: "rgba(245,100,84,0.08)", border: "1px solid var(--hc-active)", color: "var(--hc-active)" }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result !== null && (
        <div className="hc-card overflow-hidden p-0">
          <div
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--hc-text-muted)", borderBottom: "1px solid var(--hc-border)" }}
          >
            Result
          </div>
          <div className="p-4">
            <ResponseDisplay data={result} mode={responseMode} />
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "var(--hc-text-muted)" }}
          >
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: showHistory ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}
            >
              <path d="M4 2.5L8 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recent History ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map((h) => (
                <div key={h.id} className="rounded-lg p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--hc-text-muted)" }}>
                    <span>Input: {JSON.stringify(h.input).slice(0, 80)}</span>
                    <span>{new Date(h.ts).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1">
                    <ResponseDisplay data={h.output} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
