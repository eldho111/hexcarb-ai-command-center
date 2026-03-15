# CLAUDE.md — HexCarb AI Command Center

> **Purpose**: Shared coordination file for all AI agents (Claude, Codex, etc.)
> working on this repository. Read this FIRST before making changes.

---

## Architecture (4-Layer Stack)

```
Browser (ai.hexcarb.in)
  → Vercel (Next.js + Basic Auth + Proxy)
    → Cloudflare Tunnel (api.hexcarb.in)
      → RunPod GPU (FastAPI + Ollama + ChromaDB)
```

| Layer | URL / Address | What it does |
|-------|--------------|--------------|
| **Frontend** | `ai.hexcarb.in` | Next.js app, Vercel-hosted, auto-deploys from `main` |
| **Proxy** | `/api/engine/[...path]` | Server-side proxy adds X-API-Key, forwards to backend |
| **Chat Proxy** | `/api/chat` | Dedicated chat proxy with model_hint fallback |
| **Tunnel** | `api.hexcarb.in` | Cloudflare tunnel → `localhost:8000` on RunPod |
| **Backend** | `localhost:8000` | FastAPI with 122 routes across 22+ routers |
| **LLM** | `localhost:11434` | Ollama with 9 models (qwen2.5 family, deepseek-r1, mistral) |
| **Vector DB** | ChromaDB | 11,109 docs in `hexcarb_docs` collection for RAG |

### RunPod Access
```bash
ssh root@38.80.152.248 -p 31301 -i ~/.ssh/id_ed25519
```

---

## Deployment Flow

```
Commit → Push to main → GitHub Actions (Frontend Guard: lint + build) → Vercel auto-deploy
```

- **Always run `npm run build` locally or verify CI passes before pushing**
- Vercel reads env vars: `HEXCARB_GATEWAY_URL`, `HEXCARB_GATEWAY_API_KEY`, `HEXCARB_WEB_BASIC_USER`, `HEXCARB_WEB_BASIC_PASS`
- RunPod reads env vars from `/workspace/hexcarb.secrets.env`
- Critical: `HEXCARB_DEFAULT_SCOPES="*"` must be set on RunPod (grants full API access)

---

## Canonical Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard.tsx` | **Founder Dashboard** — cockpit with KPIs, lanes, alerts |
| `/panel/projects` | Panel page | Projects workspace |
| `/panel/planning_api` | Panel page | Low-level planning tool |
| `/panel/[panelId]` | `PanelPage.tsx` | Dynamic panels from `panels.ts` |
| `/panel/company_planner` | Redirect → `/panel/projects` | Legacy redirect |
| `/panel/planning` | Redirect → `/panel/projects` | Legacy redirect |

---

## DO NOT TOUCH — Protected Patterns

These are load-bearing architectural decisions. Do NOT change without explicit user approval:

1. **`src/components/views/`** — Premium view components (CrudView, DashboardView, FormActionView, ListDetailView, WorkflowView). Do NOT delete or simplify.
2. **`src/components/widgets/`** — Premium widget library (DataTable, DetailCard, FormPanel, StatusBadge, etc.). Do NOT delete.
3. **`src/lib/panels.ts` → `viewType` / `viewConfig`** — Each panel has a view type and config. Do NOT flatten to raw runner-only panels.
4. **`src/lib/panels.ts` → `compartment`** — Sidebar groups panels by compartment (Overview, Projects, R&D, Growth, Operations, Engine, Advanced). Do NOT flatten.
5. **`src/lib/useEngine.ts`** — Shared engine fetch hook. Do NOT remove.
6. **Founder Dashboard (`/`)** — Must remain the home page. Do NOT replace with a panel catalog.
7. **Sidebar compartment navigation** — Must stay grouped by business function. Do NOT simplify to a flat list.
8. **`middleware.ts`** — Basic Auth. Do NOT remove or bypass.

---

## Backend API Summary (122 routes)

### Core
`/health`, `/ready`, `/status`, `/state`, `/engine/health`

### Chat & AI
`/chat` (POST), `/chat_stream` (POST), `/models`, `/models/registry`, `/set_model`, `/analyze_query`

### Experiments & R&D
`/experiments/*` (drafts, extract, search, ingest, validate, readiness, index_status)

### Execution & Planning
`/execution/*` (goals, tasks, plan/weekly, risks, health, silence, time_delta)
`/planning/*` (context, constraints, recompute, assumption)

### Intelligence
`/lead_intel/*` (status, leads), `/scout/*` (list, ingest), `/news/*`, `/funding/*`

### Operations
`/compliance/*`, `/quality/*`, `/actions/*`, `/notifications/*`, `/messages/*`

### Data & Knowledge
`/domains/*` (hr, procurement, assets, sales), `/sources`, `/ingest_path`, `/ingest_files`, `/diag/rag`

### Advanced
`/cognition/*` (POST only), `/narratives/*`, `/decisions/*`, `/measurements/*`, `/reasoning/*`, `/objects/*`

---

## Key Backend Fixes (Applied 2026-03-15)

1. **Ollama Python client v0.6.1** returns Pydantic `ChatResponse` objects, NOT dicts.
   - Fix: `_extract_chat_content(resp)` helper in `hexcarb_orchestrator.py` handles both.
   - 4 call sites patched in `_probe_working_models()`, `chat_ollama()` try/retry/fallback.
2. **Chat model hint** changed from `MODEL_DEEP` (deepseek-r1:32b, slow) to `MODEL_LIGHT` (qwen2.5:7b, fast) in `hexcarb_api.py`.
3. **Scopes**: `HEXCARB_DEFAULT_SCOPES="*"` added to env (was `rnd:read`, blocked Lead Intel).
4. **start.sh**: Auto-installs `ollama` and `cloudflared` if missing after pod rebuild.

---

## Agent Handoff Log

Record what you changed here so the next agent has context:

```
2026-03-15 Claude: Fixed SSH config (~/.ssh/config stray 'ssh' on line 7)
2026-03-15 Claude: Installed ollama + cloudflared on RunPod after pod rebuild
2026-03-15 Claude: Fixed Ollama Pydantic/dict issue (_extract_chat_content helper)
2026-03-15 Claude: Changed chat model hint to MODEL_LIGHT for faster responses
2026-03-15 Claude: Added HEXCARB_DEFAULT_SCOPES="*" to fix Lead Intel scope error
2026-03-15 Claude: Updated start.sh with auto-install for ollama + cloudflared
2026-03-15 Claude: Pushed LeadIntelPanel.tsx, chat/route.ts, corrected panel quickCalls
2026-03-15 Claude: Restored premium UI after accidental overwrite (ad0b613)
2026-03-15 Codex: Built founder dashboard, projects workspace, planning dashboard
2026-03-15 Codex: Added frontend release guardrails (GitHub Actions + docs)
2026-03-15 Codex: Added ui-release-strategy.md and update-path.md
```

---

## Vercel Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `HEXCARB_GATEWAY_URL` | Yes | `https://api.hexcarb.in` — backend URL |
| `HEXCARB_GATEWAY_API_KEY` | Yes | API key matching RunPod's `HEXCARB_API_KEY` |
| `HEXCARB_WEB_BASIC_USER` | Yes | Basic Auth username for UI |
| `HEXCARB_WEB_BASIC_PASS` | Yes | Basic Auth password for UI |
| `HEXCARB_GATEWAY_SCOPES` | No | Default: `*` |
| `HEXCARB_CHAT_TIMEOUT_MS` | No | Default: `70000` |

## RunPod Services

| Service | Port | Start Command | Auto-install |
|---------|------|---------------|-------------|
| FastAPI | 8000 | `uvicorn hexcarb_api:app` | N/A (Python) |
| Ollama | 11434 | `ollama serve` | Yes (start.sh) |
| Cloudflared | N/A | `cloudflared tunnel run` | Yes (start.sh) |

Startup: `/workspace/start.sh` starts all 3 services.
Secrets: `/workspace/hexcarb.secrets.env` (sourced before FastAPI start).
