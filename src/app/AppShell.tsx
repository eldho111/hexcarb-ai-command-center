"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { getPanelById } from "@/lib/panels";

type Theme = "light" | "dark";
type EngineStatus = "ok" | "down" | "unknown";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("hc-theme");
  if (stored === "dark" || stored === "light") return stored;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("unknown");
  const pathname = usePathname();

  /* ── Theme management ─────────────────────────────────────── */
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

  /* ── Engine polling ────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;

    async function checkEngine() {
      try {
        const res = await fetch("/api/engine/ready", {
          signal: AbortSignal.timeout(8000),
        });
        if (!mounted) return;
        setEngineStatus(res.ok ? "ok" : "down");
      } catch {
        if (mounted) setEngineStatus("down");
      }
    }

    checkEngine();
    const interval = setInterval(checkEngine, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* ── Close mobile sidebar on route change ──────────────────── */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  /* ── Derive panel label from route ─────────────────────────── */
  const panelLabel = useMemo(() => {
    if (!pathname?.startsWith("/panel/")) return undefined;
    const panelId = pathname.split("/panel/")[1]?.split("/")[0];
    if (!panelId) return undefined;
    const panel = getPanelById(panelId);
    return panel?.label ?? panelId.replace(/_/g, " ");
  }, [pathname]);

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        engineStatus={engineStatus}
      />

      <div
        className="flex flex-col min-h-dvh transition-[margin] duration-200"
        style={{ marginLeft: "var(--sidebar-offset, 0px)" }}
      >
        <TopBar
          panelLabel={panelLabel}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onToggleTheme={toggleTheme}
          theme={theme}
          engineStatus={engineStatus}
        />

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Push content right on desktop where sidebar is fixed */}
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
