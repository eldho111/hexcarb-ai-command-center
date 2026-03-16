"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import type { AppMeta } from "@/lib/meta";
import { COMPARTMENT_LABELS, getPanelById } from "@/lib/panels";

type Theme = "light" | "dark";
type EngineStatus = "ready" | "degraded" | "down" | "booting" | "unknown";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("hc-theme");
  if (stored === "dark" || stored === "light") return stored;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeEngineStatus(value: unknown): EngineStatus {
  switch (value) {
    case "ready":
    case "degraded":
    case "down":
    case "booting":
      return value;
    default:
      return "unknown";
  }
}

function countDependencyIssues(dependencies: Record<string, unknown> | null): number {
  if (!dependencies) return 0;
  let count = 0;
  for (const payload of Object.values(dependencies)) {
    const dep = asRecord(payload);
    if (!dep) continue;
    const desired = dep.desired !== false;
    const status = String(dep.status || "unknown");
    if (!desired) continue;
    if (["up", "unmanaged_up", "optional_down"].includes(status)) continue;
    count += 1;
  }
  return count;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sidebarOpenForPath, setSidebarOpenForPath] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("unknown");
  const [engineHint, setEngineHint] = useState<string | null>(null);
  const [engineIssueCount, setEngineIssueCount] = useState(0);
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null);
  const sidebarOpen = sidebarOpenForPath === pathname;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("hc-theme", next);
      return next;
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkEngine() {
      try {
        const res = await fetch("/api/engine/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!mounted) return;
        if (!res.ok) {
          setEngineStatus("down");
          setEngineHint("Engine status endpoint is not responding.");
          setEngineIssueCount(0);
          return;
        }

        const payload = (await res.json().catch(() => null)) as unknown;
        const obj = asRecord(payload);
        const startup = asRecord(obj?.startup);
        const dependencies = asRecord(obj?.dependencies);

        setEngineStatus(normalizeEngineStatus(obj?.mode));
        setEngineHint(asString(startup?.recovery_hint) || asString(obj?.startup_hint));
        setEngineIssueCount(countDependencyIssues(dependencies));
      } catch {
        if (mounted) {
          setEngineStatus("down");
          setEngineHint("Engine status endpoint is unreachable.");
          setEngineIssueCount(0);
        }
      }
    }

    void checkEngine();
    const interval = setInterval(checkEngine, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
      try {
        const res = await fetch("/api/meta", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!mounted || !res.ok) return;
        const payload = (await res.json()) as AppMeta;
        if (mounted) setAppMeta(payload);
      } catch {
        if (mounted) setAppMeta(null);
      }
    }

    void loadMeta();
    return () => {
      mounted = false;
    };
  }, []);

  const routeMeta = useMemo(() => {
    if (pathname === "/") {
      return {
        panelLabel: "Founder Dashboard",
        compartmentLabel: COMPARTMENT_LABELS.overview,
      };
    }

    if (!pathname?.startsWith("/panel/")) {
      return {
        panelLabel: undefined,
        compartmentLabel: undefined,
      };
    }

    const panelId = pathname.split("/panel/")[1]?.split("/")[0];
    if (!panelId) {
      return {
        panelLabel: undefined,
        compartmentLabel: undefined,
      };
    }

    const panel = getPanelById(panelId);
    return {
      panelLabel: panel?.label ?? panelId.replace(/_/g, " "),
      compartmentLabel: panel ? COMPARTMENT_LABELS[panel.compartment] : "Workspace",
    };
  }, [pathname]);

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpenForPath(null)}
        engineStatus={engineStatus}
        engineHint={engineHint}
        engineIssueCount={engineIssueCount}
      />

      <div
        className="flex min-h-dvh flex-col transition-[margin] duration-200"
        style={{ marginLeft: "var(--sidebar-offset, 0px)" }}
      >
        <TopBar
          panelLabel={routeMeta.panelLabel}
          compartmentLabel={routeMeta.compartmentLabel}
          onToggleSidebar={() => setSidebarOpenForPath((value) => (value === pathname ? null : pathname))}
          onToggleTheme={toggleTheme}
          theme={theme}
          engineStatus={engineStatus}
          engineHint={engineHint}
          engineIssueCount={engineIssueCount}
          appMeta={appMeta}
        />

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          :root {
            --sidebar-offset: var(--sidebar-width);
          }
        }
      `}</style>
    </>
  );
}
