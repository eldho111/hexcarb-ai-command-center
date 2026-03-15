import { notFound, redirect } from "next/navigation";

import { PanelPage } from "@/components/PanelPage";
import { getPanelById } from "@/lib/panels";

export default async function PanelRoute({
  params,
}: {
  params: Promise<{ panelId: string }>;
}) {
  const { panelId } = await params;
  if (panelId === "planning" || panelId === "company_planner") {
    redirect("/panel/projects");
  }

  const panel = getPanelById(panelId);
  if (!panel) notFound();
  return <PanelPage panel={panel} />;
}
