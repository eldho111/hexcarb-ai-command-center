"use client";

export interface ActionDef {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost" | "accent";
  loading?: boolean;
  disabled?: boolean;
}

export function ActionBar({ actions }: { actions: ActionDef[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a, i) => {
        const cls =
          a.variant === "primary"
            ? "hc-btn hc-btn-primary"
            : a.variant === "accent"
              ? "hc-btn hc-btn-accent"
              : "hc-btn hc-btn-ghost";
        return (
          <button
            key={i}
            className={`${cls} text-xs`}
            onClick={a.onClick}
            disabled={a.loading || a.disabled}
          >
            {a.loading && (
              <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
