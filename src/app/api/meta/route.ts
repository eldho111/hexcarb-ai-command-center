import type { AppMeta } from "@/lib/meta";
import { maskGatewayHostLabel, resolveEngineConfig } from "@/lib/server/engineGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_SOURCE = "github:eldho111/hexcarb-ai-command-center";
const BUILD_BOOT_TIME = new Date().toISOString();

function shortCommit(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "local-dev";
  return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
}

export async function GET() {
  const payload: AppMeta = {
    app_commit: shortCommit(
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.HEXCARB_APP_COMMIT || "local-dev",
    ),
    vercel_env: (process.env.VERCEL_ENV || process.env.NODE_ENV || "local").trim(),
    build_time: (
      process.env.VERCEL_DEPLOYMENT_CREATED_AT || process.env.BUILD_TIME || BUILD_BOOT_TIME
    ).trim(),
    gateway_host_label: maskGatewayHostLabel(resolveEngineConfig().upstreamBaseUrl),
    repo_source: REPO_SOURCE,
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
