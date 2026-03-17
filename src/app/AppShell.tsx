"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { UtilityDrawer, type UtilityDrawerId } from "@/components/UtilityDrawer";
import type { CompanyDashboardSnapshot } from "@/lib/dashboard";
import type { AppMeta } from "@/lib/meta";
import { COMPARTMENT_LABELS, getPanelById, getWorkspaceById, type WorkspaceId } from "@/lib/panels";

type Theme = "light" | "dark";
type EngineStatus = "ready" | "degraded" | "down" | "booting" | "unknown";
type RecentRoute = {
  href: string;
  label: string;
  meta?: string;
};

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

function loadRecentRoutes(): RecentRoute[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("hc-recent-routes") || "[]") as RecentRoute[];
  } catch {
    return [];
  }
}

function saveRecentRoutes(routes: RecentRoute[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("hc-recent-routes", JSON.stringify(routes));
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sidebarOpenForPath, setSidebarOpenForPath] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("unknown");
  const [engineHint, setEngineHint] = useState<string | null>(null);
  const [engineIssueCount, setEngineIssueCount] = useState(0);
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null);
  const [utilityOpen, setUtilityOpen] = useState<UtilityDrawerId | null>(null);
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>(loadRecentRoutes);
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

  useEffect(() => {
    let mounted = true;

    async function loadSnapshot() {
      try {
        const res = await fetch("/api/dashboard/company", {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!mounted || !res.ok) return;
        const payload = (await res.json()) as CompanyDashboardSnapshot;
        if (mounted) setSnapshot(payload);
      } catch {
        if (mounted) setSnapshot(null);
      }
    }

    void loadSnapshot();
    const interval = setInterval(loadSnapshot, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const routeMeta = useMemo(() => {
    if (pathname === "/") {
      return {
        panelLabel: "HexCarb Dashboard",
        compartmentLabel: "Overview",
      };
    }

    if (pathname.startsWith("/workspace/")) {
      const workspaceId = pathname.split("/workspace/")[1]?.split("/")[0] || "";
      const workspace = getWorkspaceById(workspaceId);
      return {
        panelLabel: workspace?.label,
        compartmentLabel: "Workspace",
      };
    }

    if (!pathname.startsWith("/panel/")) {
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
    const compartmentLabel = panel?.utility
      ? "Utility"
      : panel?.workspaceId
        ? COMPARTMENT_LABELS[panel.workspaceId]
        : panel
          ? COMPARTMENT_LABELS[panel.compartment]
          : "Workspace";

    return {
      panelLabel: panel?.label ?? panelId.replace(/_/g, " "),
      compartmentLabel,
    };
  }, [pathname]);

  const workspaceBadges = useMemo(() => {
    if (!snapshot) {
      return {
        dashboard: 0,
        projects: 0,
        rnd: 0,
        growth: 0,
        operations: 0,
        engine: engineIssueCount,
      } satisfies Partial<Record<WorkspaceId | "dashboard", number>>;
    }

    return {
      dashboard: snapshot.alerts.length,
      projects: snapshot.execution.overdue_count + snapshot.execution.stalled_count + snapshot.today.blocked_items.length,
      rnd: snapshot.rnd.draft_count + (snapshot.rnd.training_ready ? 0 : 1),
      growth: (snapshot.growth.lead_status.available ? 0 : 1) + (snapshot.growth.lead_status.warning ? 1 : 0),
      operations: snapshot.operations.compliance_due.length + snapshot.inbox.urgent_count,
      engine: snapshot.engine.module_errors.length + (snapshot.engine.mode === "ready" ? 0 : 1),
    } satisfies Partial<Record<WorkspaceId | "dashboard", number>>;
  }, [snapshot, engineIssueCount]);

  const inboxCount = snapshot?.inbox.unread_count ?? 0;

  useEffect(() => {
    const nextRoute = {
      href: pathname,
      label: routeMeta.panelLabel || routeMeta.compartmentLabel || "HexCarb",
      meta: routeMeta.compartmentLabel,
    };
    setRecentRoutes((prev) => {
      const next = [nextRoute, ...prev.filter((route) => route.href !== pathname)].slice(0, 8);
      saveRecentRoutes(next);
      return next;
    });
  }, [pathname, routeMeta]);

  useEffect(() => {
    setSidebarOpenForPath(null);
  }, [pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setUtilityOpen("quick_switch");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpenForPath(null)}
        engineStatus={engineStatus}
        engineHint={engineHint}
        engineIssueCount={engineIssueCount}
        inboxCount={inboxCount}
        workspaceBadges={workspaceBadges}
        onOpenAssistant={() => setUtilityOpen("assistant")}
        onOpenInbox={() => setUtilityOpen("inbox")}
        onOpenQuickSwitch={() => setUtilityOpen("quick_switch")}
      />

      <div className="flex min-h-dvh flex-col transition-[margin] duration-200" style={{ marginLeft: "var(--sidebar-offset, 0px)" }}>
        <TopBar
          panelLabel={routeMeta.panelLabel}
          compartmentLabel={routeMeta.compartmentLabel}
          onToggleSidebar={() => setSidebarOpenForPath((value) => (value === pathname ? null : pathname))}
          onToggleTheme={toggleTheme}
          onOpenAssistant={() => setUtilityOpen("assistant")}
          onOpenInbox={() => setUtilityOpen("inbox")}
          onOpenQuickSwitch={() => setUtilityOpen("quick_switch")}
          theme={theme}
          engineStatus={engineStatus}
          engineHint={engineHint}
          engineIssueCount={engineIssueCount}
          inboxCount={inboxCount}
          appMeta={appMeta}
        />

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <UtilityDrawer
        utility={utilityOpen}
        snapshot={snapshot}
        recentRoutes={recentRoutes}
        onClose={() => setUtilityOpen(null)}
        onOpenUtility={(utility) => setUtilityOpen(utility)}
      />

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
