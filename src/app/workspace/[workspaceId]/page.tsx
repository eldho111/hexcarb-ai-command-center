import { notFound } from "next/navigation";

import { WorkspacePage } from "@/components/WorkspacePage";
import { getWorkspaceById } from "@/lib/panels";

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) notFound();
  return <WorkspacePage workspace={workspace} />;
}
