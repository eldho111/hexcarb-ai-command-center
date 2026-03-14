"use client";

const VARIANT_MAP: Record<string, string> = {
  ok: "success", done: "success", completed: "success", approved: "success",
  active: "success", running: "success", healthy: "success", true: "success",
  pending: "warning", open: "warning", waiting: "warning", idle: "warning",
  draft: "warning", queued: "warning",
  rejected: "error", failed: "error", error: "error", down: "error",
  critical: "error", false: "error", overdue: "error",
};

const COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  success: { bg: "rgba(78,124,116,0.12)", fg: "var(--hc-green)", dot: "var(--hc-green)" },
  warning: { bg: "rgba(142,106,53,0.12)", fg: "var(--hc-accent)", dot: "var(--hc-accent)" },
  error:   { bg: "rgba(245,100,84,0.12)", fg: "var(--hc-active)", dot: "var(--hc-active)" },
  info:    { bg: "rgba(15,25,36,0.08)",   fg: "var(--hc-text-muted)", dot: "var(--hc-text-muted)" },
};

export function StatusBadge({ status, variant }: { status: string; variant?: string }) {
  const v = variant || VARIANT_MAP[status.toLowerCase()] || "info";
  const c = COLORS[v] || COLORS.info;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: c.dot }}
      />
      {status}
    </span>
  );
}
