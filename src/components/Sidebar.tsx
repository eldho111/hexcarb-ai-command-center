"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  COMPARTMENT_LABELS,
  COMPARTMENT_ORDER,
  PANELS,
  type NavCompartmentId,
  type PanelDef,
} from "@/lib/panels";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  engineStatus: "ok" | "down" | "unknown";
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  advanced?: boolean;
};

function HexIcon() {
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0L27.856 8V24L14 32L0.144 24V8L14 0Z" fill="var(--hc-accent)" />
      <path d="M14 6L22.66 11V21L14 26L5.34 21V11L14 6Z" fill="var(--hc-bg)" />
      <path d="M14 10L19.196 13V19L14 22L8.804 19V13L14 10Z" fill="var(--hc-accent)" />
    </svg>
  );
}

function compartmentStyles(compartment: NavCompartmentId): { surface: string; border: string; color: string } {
  switch (compartment) {
    case "overview":
      return { surface: "rgba(15,25,36,0.06)", border: "rgba(15,25,36,0.12)", color: "var(--hc-heading)" };
    case "projects":
      return { surface: "rgba(142,106,53,0.12)", border: "rgba(142,106,53,0.24)", color: "var(--hc-accent)" };
    case "rnd":
      return { surface: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.24)", color: "var(--hc-green)" };
    case "growth":
      return { surface: "rgba(95,120,154,0.12)", border: "rgba(95,120,154,0.24)", color: "#496c8d" };
    case "operations":
      return { surface: "rgba(196,129,77,0.12)", border: "rgba(196,129,77,0.24)", color: "#8a5b2f" };
    case "engine":
      return { surface: "rgba(109,124,167,0.12)", border: "rgba(109,124,167,0.24)", color: "#52659a" };
    case "advanced":
    default:
      return { surface: "rgba(15,25,36,0.08)", border: "rgba(15,25,36,0.14)", color: "var(--hc-text-muted)" };
  }
}

function CompartmentIcon({ compartment }: { compartment: NavCompartmentId }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (compartment) {
    case "overview":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "projects":
      return (
        <svg {...props}>
          <path d="M3 7h7v7H3z" />
          <path d="M14 7h7v4h-7z" />
          <path d="M14 15h7v6h-7z" />
          <path d="M3 18h7v3H3z" />
        </svg>
      );
    case "rnd":
      return (
        <svg {...props}>
          <path d="M9 3h6v4H9z" />
          <path d="M4 7h16l-2 14H6z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "growth":
      return (
        <svg {...props}>
          <polyline points="4 14 9 9 13 13 20 6" />
          <polyline points="16 6 20 6 20 10" />
          <path d="M4 20h16" />
        </svg>
      );
    case "operations":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "engine":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "advanced":
    default:
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function NavGroup({
  compartment,
  items,
  activeHref,
  defaultOpen,
}: {
  compartment: NavCompartmentId;
  items: NavItem[];
  activeHref: string | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = items.some((item) => item.href === activeHref);
  const theme = compartmentStyles(compartment);

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition-colors"
        style={{
          background: hasActive ? theme.surface : "transparent",
          borderColor: hasActive ? theme.border : "transparent",
          color: hasActive ? theme.color : "var(--hc-text-muted)",
        }}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border" style={{ background: theme.surface, borderColor: theme.border, color: theme.color }}>
          <CompartmentIcon compartment={compartment} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em]">{COMPARTMENT_LABELS[compartment]}</span>
          <span className="mt-1 block text-xs" style={{ color: "var(--hc-text-muted)" }}>{items.length} spaces</span>
        </span>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: theme.border, color: theme.color }}>
          {items.length}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}>
          <polyline points="4 2 8 6 4 10" />
        </svg>
      </button>

      {open ? (
        <div className="mt-2 rounded-[22px] border p-2" style={{ background: "rgba(255,255,255,0.72)", borderColor: theme.border }}>
          {items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="mb-1 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors last:mb-0"
                style={{
                  color: isActive ? theme.color : "var(--hc-text-muted)",
                  background: isActive ? theme.surface : "transparent",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: isActive ? theme.color : "rgba(15,25,36,0.12)" }} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.advanced ? (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ background: "rgba(15,25,36,0.08)", color: "var(--hc-text-muted)" }}>
                    Adv
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function byPriority(a: PanelDef, b: PanelDef): number {
  const aPriority = a.priority ?? 100;
  const bPriority = b.priority ?? 100;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.label.localeCompare(b.label);
}

export default function Sidebar({ open, onClose, engineStatus }: SidebarProps) {
  const pathname = usePathname();
  const activePanelId = pathname?.startsWith("/panel/")
    ? pathname.split("/panel/")[1]?.split("/")[0] ?? null
    : null;

  const grouped = useMemo(() => {
    const out: Record<NavCompartmentId, PanelDef[]> = {
      overview: [],
      projects: [],
      rnd: [],
      growth: [],
      operations: [],
      engine: [],
      advanced: [],
    };

    for (const panel of PANELS) {
      out[panel.compartment].push(panel);
    }

    for (const compartment of COMPARTMENT_ORDER) {
      out[compartment].sort(byPriority);
    }

    return out;
  }, []);

  const activeHref = pathname === "/" ? "/" : activePanelId ? `/panel/${activePanelId}` : null;
  const statusDot =
    engineStatus === "ok"
      ? "var(--hc-green)"
      : engineStatus === "down"
        ? "var(--hc-active)"
        : "var(--hc-text-muted)";

  const sidebarContent = (
    <div className="flex h-full flex-col" style={{ background: "var(--hc-bg)", borderRight: "1px solid var(--hc-border)" }}>
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <HexIcon />
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight" style={{ color: "var(--hc-heading)", fontFamily: "var(--font-heading)" }}>
              HexCarb
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "var(--hc-text-muted)" }}>
              Founder Console
            </span>
          </div>
        </Link>

        <div className="rounded-[22px] border px-4 py-3" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,246,241,0.98))", borderColor: "var(--hc-border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Company cockpit
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                {engineStatus === "ok" ? "Systems ready" : engineStatus === "down" ? "Needs intervention" : "Checking live state"}
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: statusDot }} />
              {engineStatus}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4">
        {COMPARTMENT_ORDER.map((compartment) => {
          const items: NavItem[] = compartment === "overview"
            ? [
                { id: "home", label: "Founder Dashboard", href: "/" },
                ...grouped[compartment].map((panel) => ({
                  id: panel.id,
                  label: panel.label,
                  href: `/panel/${panel.id}`,
                  advanced: panel.advanced,
                })),
              ]
            : grouped[compartment].map((panel) => ({
                id: panel.id,
                label: panel.label,
                href: `/panel/${panel.id}`,
                advanced: panel.advanced,
              }));

          if (items.length === 0) return null;

          return (
            <NavGroup
              key={compartment}
              compartment={compartment}
              items={items}
              activeHref={activeHref}
              defaultOpen={compartment === "overview" || compartment === "projects" || items.some((item) => item.href === activeHref)}
            />
          );
        })}
      </nav>

      <div className="px-5 py-3 text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--hc-text-muted)", borderTop: "1px solid var(--hc-border)", opacity: 0.68 }}>
        Release flow: GitHub to Vercel
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-dvh flex-col lg:flex" style={{ width: "var(--sidebar-width)" }}>
        {sidebarContent}
      </aside>

      {open ? (
        <>
          <div className="fixed inset-0 z-50 lg:hidden" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
          <aside className="fixed left-0 top-0 z-50 flex h-dvh flex-col lg:hidden" style={{ width: "var(--sidebar-width)", animation: "slideInLeft 200ms ease" }}>
            {sidebarContent}
          </aside>
          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      ) : null}
    </>
  );
}
