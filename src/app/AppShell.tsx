"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import type { AppMeta } from "@/lib/meta";
import { COMPARTMENT_LABELS, getPanelById } from "@/lib/panels";

type Theme = "light" | "dark";
type EngineStatus = "ok" | "down" | "unknown";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("hc-theme");
  if (stored === "dark" || stored === "light") return stored;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("unknown");
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

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
        const res = await fetch("/api/engine/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!mounted) return;
        setEngineStatus(res.ok ? "ok" : "down");
      } catch {
        if (mounted) setEngineStatus("down");
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
    setSidebarOpen(false);
  }, [pathname]);

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
        onClose={() => setSidebarOpen(false)}
        engineStatus={engineStatus}
      />

      <div
        className="flex min-h-dvh flex-col transition-[margin] duration-200"
        style={{ marginLeft: "var(--sidebar-offset, 0px)" }}
      >
        <TopBar
          panelLabel={routeMeta.panelLabel}
          compartmentLabel={routeMeta.compartmentLabel}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onToggleTheme={toggleTheme}
          theme={theme}
          engineStatus={engineStatus}
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
