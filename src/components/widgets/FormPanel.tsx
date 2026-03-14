"use client";

import React, { useCallback, useState } from "react";

export interface FormFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "checkbox" | "json" | "file";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  hint?: string;
}

export function FormPanel({
  fields,
  onSubmit,
  submitLabel = "Submit",
  loading = false,
}: {
  fields: FormFieldDef[];
  onSubmit: (data: Record<string, unknown>) => void;
  submitLabel?: string;
  loading?: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) {
      init[f.key] = f.defaultValue ?? (f.type === "checkbox" ? false : f.type === "number" ? "" : "");
    }
    return init;
  });

  const set = useCallback((key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Build clean output
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      let v = values[f.key];
      if (f.type === "number" && typeof v === "string") v = v ? Number(v) : undefined;
      if (f.type === "json" && typeof v === "string") {
        try { v = JSON.parse(v); } catch { /* keep raw */ }
      }
      if (f.type === "file") continue; // file handled via fileData
      if (v !== undefined && v !== "") out[f.key] = v;
    }
    // Include file data
    if (values.__file_b64) out.content_b64 = values.__file_b64;
    if (values.__file_name) out.name = values.__file_name;
    onSubmit(out);
  }

  function handleFile(key: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1] || "";
      set("__file_b64", b64);
      set("__file_name", file.name);
      set(key, file.name);
    };
    reader.readAsDataURL(file);
  }

  const inputStyle = {
    background: "var(--hc-card-bg)",
    border: "1px solid var(--hc-border)",
    color: "var(--hc-text)",
    borderRadius: "var(--radius-sm)",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
            {f.label}
            {f.required && <span style={{ color: "var(--hc-active)" }}> *</span>}
          </label>

          {f.type === "textarea" || f.type === "json" ? (
            <textarea
              className="w-full rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              style={inputStyle}
              rows={f.type === "json" ? 6 : 3}
              placeholder={f.placeholder || (f.type === "json" ? '{ }' : "")}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
            />
          ) : f.type === "select" ? (
            <select
              className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              style={inputStyle}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
            >
              <option value="">Select…</option>
              {(f.options || []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!values[f.key]}
                onChange={(e) => set(f.key, e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--hc-accent)" }}
              />
              <span style={{ color: "var(--hc-text)" }}>{f.placeholder || "Enabled"}</span>
            </label>
          ) : f.type === "file" ? (
            <input
              type="file"
              className="w-full text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
              style={{ color: "var(--hc-text-muted)" }}
              onChange={(e) => e.target.files?.[0] && handleFile(f.key, e.target.files[0])}
            />
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              style={inputStyle}
              placeholder={f.placeholder}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
            />
          )}

          {f.hint && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>{f.hint}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        className="hc-btn hc-btn-primary text-sm"
        disabled={loading}
      >
        {loading && (
          <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {submitLabel}
      </button>
    </form>
  );
}
