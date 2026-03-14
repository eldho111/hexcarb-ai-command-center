"use client";

import { useCallback, useState } from "react";
import { useEngineGet, engineFetch } from "@/lib/useEngine";
import { DataTable, type ColumnDef } from "@/components/widgets/DataTable";
import { DetailCard } from "@/components/widgets/DetailCard";
import { ActionBar, type ActionDef } from "@/components/widgets/ActionBar";
import { FormPanel, type FormFieldDef } from "@/components/widgets/FormPanel";

export interface ListDetailConfig {
  listEndpoint: string;
  listKey: string;
  idField?: string;
  detailEndpoint?: string;      // e.g. "/experiments/{id}"
  columns: ColumnDef[];
  createEndpoint?: string;
  createFields?: FormFieldDef[];
  createLabel?: string;
  searchEndpoint?: string;
  searchFields?: FormFieldDef[];
  searchResultKey?: string;
  refreshEndpoint?: string;     // POST endpoint for refresh (news, funding)
  emptyMessage?: string;
}

export function ListDetailView({ config }: { config: ListDetailConfig }) {
  const {
    listEndpoint, listKey, idField = "id", detailEndpoint,
    columns, createEndpoint, createFields, createLabel,
    searchEndpoint, searchFields, searchResultKey,
    refreshEndpoint, emptyMessage,
  } = config;

  const { data: listData, loading, refetch } = useEngineGet<Record<string, unknown>>(listEndpoint);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[] | null>(null);

  const items = (listData?.[listKey] as Record<string, unknown>[]) || [];
  const displayItems = searchResults ?? items;

  const handleRowClick = useCallback(async (row: Record<string, unknown>) => {
    const id = String(row[idField] ?? "");
    if (detailEndpoint && id) {
      setDetailLoading(true);
      try {
        const path = detailEndpoint.replace("{id}", id);
        const detail = await engineFetch<Record<string, unknown>>(path);
        // Extract the nested value (skip "ok")
        const keys = Object.keys(detail).filter((k) => k !== "ok");
        const inner = keys.length === 1 ? (detail[keys[0]] as Record<string, unknown>) : detail;
        setSelected(inner);
      } catch {
        setSelected(row);
      }
      setDetailLoading(false);
    } else {
      setSelected(row);
    }
  }, [detailEndpoint, idField]);

  async function handleCreate(formData: Record<string, unknown>) {
    if (!createEndpoint) return;
    setCreateLoading(true);
    try {
      await engineFetch(createEndpoint, { method: "POST", body: JSON.stringify(formData) });
      setShowCreate(false);
      refetch();
    } catch { /* error shown via hook */ }
    setCreateLoading(false);
  }

  async function handleSearch(formData: Record<string, unknown>) {
    if (!searchEndpoint) return;
    try {
      const res = await engineFetch<Record<string, unknown>>(searchEndpoint, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const key = searchResultKey || "results";
      setSearchResults((res[key] as Record<string, unknown>[]) || []);
    } catch { /* silent */ }
  }

  async function handleRefresh() {
    if (!refreshEndpoint) return;
    setRefreshing(true);
    try {
      await engineFetch(refreshEndpoint, { method: "POST", body: JSON.stringify({}) });
      refetch();
    } catch { /* silent */ }
    setRefreshing(false);
  }

  // Action bar
  const actions: ActionDef[] = [];
  if (createEndpoint && createFields) {
    actions.push({ label: `+ ${createLabel || "Create"}`, onClick: () => setShowCreate(!showCreate), variant: "primary" });
  }
  if (searchEndpoint && searchFields) {
    actions.push({ label: searchResults ? "Clear Search" : "Search", onClick: () => {
      if (searchResults) { setSearchResults(null); } else { setShowSearch(!showSearch); }
    }, variant: "ghost" });
  }
  if (refreshEndpoint) {
    actions.push({ label: "Refresh Data", onClick: handleRefresh, variant: "ghost", loading: refreshing });
  }
  actions.push({ label: "Reload", onClick: refetch, variant: "ghost" });

  return (
    <div className="space-y-4">
      <ActionBar actions={actions} />

      {/* Search form */}
      {showSearch && searchFields && (
        <div className="hc-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>Search</div>
          <FormPanel fields={searchFields} onSubmit={handleSearch} submitLabel="Search" />
        </div>
      )}

      {/* Create form */}
      {showCreate && createFields && (
        <div className="hc-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
            {createLabel || "Create New"}
          </div>
          <FormPanel fields={createFields} onSubmit={handleCreate} submitLabel={createLabel || "Create"} loading={createLoading} />
        </div>
      )}

      {/* Main content: list + detail */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="hc-card overflow-hidden p-0">
            <DataTable
              columns={columns}
              data={displayItems}
              onRowClick={handleRowClick}
              loading={loading}
              emptyMessage={emptyMessage}
              selectedId={selected ? String(selected[idField] ?? "") : null}
              idField={idField}
            />
          </div>
          {searchResults && (
            <p className="mt-2 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              Showing {searchResults.length} search result{searchResults.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          {detailLoading ? (
            <div className="flex items-center justify-center p-10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--hc-accent)] border-t-transparent" />
            </div>
          ) : selected ? (
            <DetailCard title="Details" data={selected} />
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg p-10 text-center"
              style={{ background: "var(--hc-bg-soft)", border: "1px dashed var(--hc-border)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 3H9V1H15V3ZM13 13H11V7H13V13ZM12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22Z" fill="var(--hc-border)" />
              </svg>
              <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
                Click a row to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
