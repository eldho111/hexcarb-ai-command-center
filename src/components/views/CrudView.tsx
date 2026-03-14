"use client";

import { useCallback, useState } from "react";
import { useEngineGet, engineFetch } from "@/lib/useEngine";
import { DataTable, type ColumnDef } from "@/components/widgets/DataTable";
import { DetailCard } from "@/components/widgets/DetailCard";
import { ActionBar, type ActionDef } from "@/components/widgets/ActionBar";
import { FormPanel, type FormFieldDef } from "@/components/widgets/FormPanel";
import { ResponseDisplay } from "@/components/widgets/ResponseDisplay";

export interface CrudConfig {
  listEndpoint: string;
  listKey: string;
  idField?: string;
  columns: ColumnDef[];
  createEndpoint?: string;
  createFields?: FormFieldDef[];
  createLabel?: string;
  createWrapKey?: string;  // wrap form data under this key
  updateEndpoint?: string; // e.g. "/compliance/tasks/{id}/update"
  updateFields?: FormFieldDef[];
  seedEndpoint?: string;
  seedLabel?: string;
  profileEndpoint?: string; // GET endpoint for profile/header section
  profileUpdateEndpoint?: string;
  profileFields?: FormFieldDef[];
  emptyMessage?: string;
}

export function CrudView({ config }: { config: CrudConfig }) {
  const {
    listEndpoint, listKey, idField = "id", columns,
    createEndpoint, createFields, createLabel, createWrapKey,
    updateEndpoint, updateFields,
    seedEndpoint, seedLabel,
    profileEndpoint, profileUpdateEndpoint, profileFields,
    emptyMessage,
  } = config;

  const { data: listData, loading, refetch } = useEngineGet<Record<string, unknown>>(listEndpoint);
  const { data: profileData, refetch: refetchProfile } = useEngineGet<Record<string, unknown>>(profileEndpoint || null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastResult, setLastResult] = useState<unknown>(null);

  const items = (listData?.[listKey] as Record<string, unknown>[]) || [];

  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    if (!createEndpoint) return;
    setFormLoading(true);
    try {
      const body = createWrapKey ? { [createWrapKey]: formData } : formData;
      await engineFetch(createEndpoint, { method: "POST", body: JSON.stringify(body) });
      setShowCreate(false);
      refetch();
    } catch { /* silent */ }
    setFormLoading(false);
  }, [createEndpoint, createWrapKey, refetch]);

  const handleUpdate = useCallback(async (formData: Record<string, unknown>) => {
    if (!updateEndpoint || !selected) return;
    setFormLoading(true);
    try {
      const id = String(selected[idField] ?? "");
      const path = updateEndpoint.replace("{id}", id);
      await engineFetch(path, { method: "POST", body: JSON.stringify(formData) });
      setShowUpdate(false);
      setSelected(null);
      refetch();
    } catch { /* silent */ }
    setFormLoading(false);
  }, [updateEndpoint, selected, idField, refetch]);

  const handleProfileUpdate = useCallback(async (formData: Record<string, unknown>) => {
    if (!profileUpdateEndpoint) return;
    setFormLoading(true);
    try {
      const res = await engineFetch<Record<string, unknown>>(profileUpdateEndpoint, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setLastResult(res);
      setShowProfile(false);
      refetchProfile();
    } catch { /* silent */ }
    setFormLoading(false);
  }, [profileUpdateEndpoint, refetchProfile]);

  async function handleSeed() {
    if (!seedEndpoint) return;
    setSeeding(true);
    try {
      await engineFetch(seedEndpoint, { method: "POST", body: JSON.stringify({}) });
      refetch();
    } catch { /* silent */ }
    setSeeding(false);
  }

  // Action bar
  const actions: ActionDef[] = [];
  if (createEndpoint && createFields) {
    actions.push({ label: `+ ${createLabel || "Create"}`, onClick: () => { setShowCreate(!showCreate); setShowUpdate(false); }, variant: "primary" });
  }
  if (profileEndpoint && profileFields) {
    actions.push({ label: showProfile ? "Hide Profile" : "Edit Profile", onClick: () => setShowProfile(!showProfile), variant: "ghost" });
  }
  if (seedEndpoint) {
    actions.push({ label: seedLabel || "Seed Defaults", onClick: handleSeed, variant: "ghost", loading: seeding });
  }
  if (updateEndpoint && updateFields && selected) {
    actions.push({ label: "Edit Selected", onClick: () => setShowUpdate(!showUpdate), variant: "accent" });
  }
  actions.push({ label: "Reload", onClick: refetch, variant: "ghost" });

  // Profile section
  const profile = profileData ? Object.fromEntries(
    Object.entries(profileData).filter(([k]) => k !== "ok").flatMap(([k, v]) =>
      typeof v === "object" && v !== null && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [[k, v]]
    )
  ) : null;

  return (
    <div className="space-y-4">
      <ActionBar actions={actions} />

      {/* Profile section */}
      {showProfile && profileFields && (
        <div className="hc-card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
            Company Profile
          </div>
          <FormPanel
            fields={profileFields.map((f): FormFieldDef => ({
              ...f,
              defaultValue: (profile?.[f.key] as FormFieldDef["defaultValue"]) ?? f.defaultValue,
            }))}
            onSubmit={handleProfileUpdate}
            submitLabel="Update Profile"
            loading={formLoading}
          />
        </div>
      )}

      {profile && !showProfile && (
        <div className="hc-card p-4">
          <DetailCard title="Company Profile" data={profile} />
        </div>
      )}

      {/* Create form */}
      {showCreate && createFields && (
        <div className="hc-card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
            {createLabel || "Create New"}
          </div>
          <FormPanel fields={createFields} onSubmit={handleCreate} submitLabel={createLabel || "Create"} loading={formLoading} />
        </div>
      )}

      {/* Update form */}
      {showUpdate && updateFields && selected && (
        <div className="hc-card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hc-text-muted)" }}>
            Update: {String(selected[idField] ?? "")}
          </div>
          <FormPanel
            fields={updateFields.map((f): FormFieldDef => ({
              ...f,
              defaultValue: (selected[f.key] as FormFieldDef["defaultValue"]) ?? f.defaultValue,
            }))}
            onSubmit={handleUpdate}
            submitLabel="Update"
            loading={formLoading}
          />
        </div>
      )}

      {/* Table + detail */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="hc-card overflow-hidden p-0">
            <DataTable
              columns={columns}
              data={items}
              onRowClick={setSelected}
              loading={loading}
              emptyMessage={emptyMessage}
              selectedId={selected ? String(selected[idField] ?? "") : null}
              idField={idField}
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <DetailCard title="Details" data={selected} />
          ) : (
            <div
              className="flex items-center justify-center p-10 text-sm"
              style={{ background: "var(--hc-bg-soft)", border: "1px dashed var(--hc-border)", borderRadius: "var(--radius-md)", color: "var(--hc-text-muted)" }}
            >
              Click a row to view details
            </div>
          )}
        </div>
      </div>

      {lastResult && <ResponseDisplay data={lastResult} />}
    </div>
  );
}
