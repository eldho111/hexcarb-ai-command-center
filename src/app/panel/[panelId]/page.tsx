import { notFound } from "next/navigation";

import { PanelPage } from "@/components/PanelPage";
import { getPanelById } from "@/lib/panels";

export default function PanelRoute({
  params,
}: {
  params: { panelId: string };
}) {
  const panel = getPanelById(params.panelId);
  if (!panel) notFound();
  return <PanelPage panel={panel} />;
}
