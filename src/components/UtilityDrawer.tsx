"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { StatusBadge } from "@/components/widgets/StatusBadge";
import type { CompanyDashboardSnapshot, DashboardListItem } from "@/lib/dashboard";
import { PANELS, PRIMARY_NAV_ITEMS } from "@/lib/panels";

export type UtilityDrawerId = "assistant" | "inbox" | "quick_switch";

type RecentRoute = {
  href: string;
  label: string;
  meta?: string;
};

type QuickLinkItem = {
  id: string;
  label: string;
  description: string;
  kind: string;
  href: string;
};

type QuickUtilityItem = {
  id: string;
  label: string;
  description: string;
  kind: string;
  utility: Exclude<UtilityDrawerId, "quick_switch">;
};

type QuickSwitchItem = QuickLinkItem | QuickUtilityItem;

function DrawerFrame({
  title,
  subtitle,
  open,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div
        aria-hidden={!open}
        className="fixed inset-0 z-40 transition-opacity"
        onClick={onClose}
        style={{
          background: open ? "rgba(10, 17, 27, 0.34)" : "transparent",
          pointerEvents: open ? "auto" : "none",
          opacity: open ? 1 : 0,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 z-50 h-full w-full max-w-[720px] border-l transition-transform duration-200"
        style={{
          transform: open ? "translateX(0)" : "translateX(104%)",
          background: "var(--hc-bg)",
          borderColor: "var(--hc-border)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <div className="flex h-full flex-col">
          <header
            className="flex items-start justify-between gap-4 border-b px-5 py-4"
            style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-chip)" }}
          >
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--hc-accent)" }}
              >
                Global Utility
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
                {subtitle}
              </p>
            </div>
            <button type="button" onClick={onClose} className="hc-btn hc-btn-ghost text-xs">
              Close
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </aside>
    </>
  );
}

function QuickItem({
  item,
  onNavigate,
  onOpenUtility,
}: {
  item: QuickSwitchItem;
  onNavigate: () => void;
  onOpenUtility: (utility: Exclude<UtilityDrawerId, "quick_switch">) => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {item.label}
          </div>
          <div className="mt-1 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            {item.description}
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ background: "var(--hc-surface-muted)", color: "var(--hc-text-muted)" }}
        >
          {item.kind}
        </span>
      </div>
    </>
  );

  if ("href" in item) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className="block rounded-[22px] border px-4 py-4 transition-colors hover:bg-black/[.03]"
        style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenUtility(item.utility)}
      className="block w-full rounded-[22px] border px-4 py-4 text-left transition-colors hover:bg-black/[.03]"
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
    >
      {content}
    </button>
  );
}

function InboxList({
  title,
  items,
  fallback,
  onSelect,
}: {
  title: string;
  items: DashboardListItem[];
  fallback: string;
  onSelect: () => void;
}) {
  return (
    <section
      className="space-y-3 rounded-[24px] border p-4"
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {title}
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href || "#"}
              onClick={onSelect}
              className="block rounded-2xl border px-3 py-3 transition-colors hover:bg-black/[.03]"
              style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    {item.title}
                  </div>
                  {item.subtitle ? (
                    <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      {item.subtitle}
                    </div>
                  ) : null}
                  {item.meta ? (
                    <div className="mt-1 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>
                      {item.meta}
                    </div>
                  ) : null}
                </div>
                {item.status ? <StatusBadge status={item.status} /> : null}
              </div>
            </Link>
          ))
        ) : (
          <div
            className="rounded-2xl border border-dashed px-3 py-4 text-sm"
            style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}
          >
            {fallback}
          </div>
        )}
      </div>
    </section>
  );
}

function AssistantDrawer({ onClose }: { onClose: () => void }) {
  return (
    <DrawerFrame
      title="Assistant"
      subtitle="The HexCarb assistant is available from every page here, with the full chat panel still available when you need a larger conversation space."
      open
      onClose={onClose}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/panel/chat" onClick={onClose} className="hc-btn hc-btn-primary text-xs">
          Open Full Page Chat
        </Link>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ background: "rgba(78,124,116,0.12)", color: "var(--hc-green)" }}
        >
          Global assistant
        </span>
      </div>
      <ChatPanel />
    </DrawerFrame>
  );
}

function InboxDrawer({ snapshot, onClose }: { snapshot: CompanyDashboardSnapshot | null; onClose: () => void }) {
  return (
    <DrawerFrame
      title="Inbox / Action Center"
      subtitle="Approvals, notifications, and messages live together here so they stop competing as standalone navigation spaces."
      open
      onClose={onClose}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Unread
          </div>
          <div className="mt-2 text-3xl font-semibold" style={{ color: "var(--hc-heading)" }}>
            {snapshot?.inbox.unread_count ?? 0}
          </div>
          <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Unread items across the action center.
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Urgent
          </div>
          <div className="mt-2 text-3xl font-semibold" style={{ color: "var(--hc-accent)" }}>
            {snapshot?.inbox.urgent_count ?? 0}
          </div>
          <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Queues that need attention first.
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Approvals
          </div>
          <div className="mt-2 text-3xl font-semibold" style={{ color: "var(--hc-heading)" }}>
            {snapshot?.inbox.approvals_count ?? 0}
          </div>
          <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Pending action requests in the queue.
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Messages
          </div>
          <div className="mt-2 text-3xl font-semibold" style={{ color: "var(--hc-heading)" }}>
            {snapshot?.inbox.messages_count ?? 0}
          </div>
          <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Active message threads surfaced from the runtime.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <InboxList
          title="Approvals"
          items={snapshot?.inbox.approvals || []}
          fallback="No pending approvals right now."
          onSelect={onClose}
        />
        <InboxList
          title="Notifications"
          items={snapshot?.inbox.notifications || []}
          fallback="No recent notifications were returned."
          onSelect={onClose}
        />
        <InboxList
          title="Messages"
          items={snapshot?.inbox.messages || []}
          fallback="No recent messages were returned."
          onSelect={onClose}
        />
      </div>
    </DrawerFrame>
  );
}

function QuickSwitchDrawer({
  snapshot,
  recentRoutes,
  onClose,
  onOpenUtility,
}: {
  snapshot: CompanyDashboardSnapshot | null;
  recentRoutes: RecentRoute[];
  onClose: () => void;
  onOpenUtility: (utility: Exclude<UtilityDrawerId, "quick_switch">) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, []);

  const items = useMemo(() => {
    const utilityItems: QuickUtilityItem[] = [
      {
        id: "utility-assistant",
        label: "Assistant",
        description: "Open the global assistant drawer.",
        utility: "assistant",
        kind: "utility",
      },
      {
        id: "utility-inbox",
        label: "Inbox / Action Center",
        description: "Open approvals, notifications, and messages in one place.",
        utility: "inbox",
        kind: "utility",
      },
    ];
    const navItems: QuickLinkItem[] = PRIMARY_NAV_ITEMS.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      description: item.href === "/" ? "Return to the HexCarb dashboard." : "Open a primary workspace window.",
      href: item.href,
      kind: item.id === "dashboard" ? "dashboard" : "workspace",
    }));
    const deepLinks: QuickLinkItem[] = PANELS.filter((panel) => !panel.advanced && !panel.utility).map((panel) => ({
      id: `panel-${panel.id}`,
      label: panel.label,
      description: panel.description,
      href: `/panel/${panel.id}`,
      kind: panel.secondaryOnly ? "deep link" : "tool",
    }));
    const recentItems: QuickLinkItem[] = recentRoutes.map((item, index) => ({
      id: `recent-${index}-${item.href}`,
      label: item.label,
      description: item.meta || "Recently opened",
      href: item.href,
      kind: "recent",
    }));

    const merged: QuickSwitchItem[] = [...recentItems, ...navItems, ...utilityItems, ...deepLinks];
    const needle = query.trim().toLowerCase();

    return merged
      .filter((item, index, array) => {
        if ("href" in item) {
          return array.findIndex((candidate) => "href" in candidate && candidate.href === item.href && candidate.label === item.label) === index;
        }
        return array.findIndex((candidate) => !("href" in candidate) && candidate.utility === item.utility) === index;
      })
      .filter((item) => {
        if (!needle) return true;
        return [item.label, item.description, item.kind].some((value) => value.toLowerCase().includes(needle));
      })
      .slice(0, 18);
  }, [query, recentRoutes]);

  return (
    <DrawerFrame
      title="Quick Switch"
      subtitle="Search workspaces, panel deep links, and recent places without adding more primary navigation. Use Cmd/Ctrl+K to open this drawer."
      open
      onClose={onClose}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search workspace, panel, or route"
          className="w-full rounded-[20px] px-4 py-3 text-sm"
          style={{ border: "1px solid var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
        />
        <div
          className="rounded-[20px] border px-4 py-3 text-xs leading-6"
          style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-chip)", color: "var(--hc-text-muted)" }}
        >
          {snapshot
            ? `${snapshot.alerts.length} active alerts and ${snapshot.inbox.unread_count} unread inbox items.`
            : "Shell snapshot not loaded yet."}
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <QuickItem
            key={item.id}
            item={item}
            onNavigate={onClose}
            onOpenUtility={(utility) => {
              onOpenUtility(utility);
            }}
          />
        ))}
      </div>
    </DrawerFrame>
  );
}

export function UtilityDrawer({
  utility,
  snapshot,
  recentRoutes,
  onClose,
  onOpenUtility,
}: {
  utility: UtilityDrawerId | null;
  snapshot: CompanyDashboardSnapshot | null;
  recentRoutes: RecentRoute[];
  onClose: () => void;
  onOpenUtility: (utility: Exclude<UtilityDrawerId, "quick_switch">) => void;
}) {
  useEffect(() => {
    if (!utility) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [utility, onClose]);

  if (utility === "assistant") return <AssistantDrawer onClose={onClose} />;
  if (utility === "inbox") return <InboxDrawer snapshot={snapshot} onClose={onClose} />;
  if (utility === "quick_switch") {
    return (
      <QuickSwitchDrawer
        snapshot={snapshot}
        recentRoutes={recentRoutes}
        onClose={onClose}
        onOpenUtility={onOpenUtility}
      />
    );
  }
  return null;
}
