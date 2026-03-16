# HexCarb Web Console

A lightweight Next.js console for the HexCarb engine.

It provides:
- A tile dashboard (mirrors the Streamlit action dock panel IDs)
- A panel page for each tile
- Quick Calls for common endpoints
- A generic API runner
- A chat UI wired primarily to `/api/chat`, with optional `/api/engine/chat_stream` compatibility streaming

## How It Connects

The browser never talks to the engine directly.

All panel calls go to the Next.js server route:
- `GET/POST/... /api/engine/*`

That route proxies to the HexCarb gateway (`HEXCARB_GATEWAY_URL`) and injects `x-api-key` from env.

The primary web-console conversation path is `POST /api/chat`, which proxies only to backend `POST /chat`.

`POST /api/engine/chat_stream` remains available as a compatibility adapter for advanced streaming and can wrap backend `POST /chat` JSON as NDJSON when needed.

## Environment Variables

Set these in Vercel (Production + Preview) or in a local `.env.local`.

- `HEXCARB_WEB_BASIC_USER` / `HEXCARB_WEB_BASIC_PASS`
  - Basic Auth for the UI and all API routes.

- `HEXCARB_GATEWAY_URL`
  - Example (local): `http://127.0.0.1:8000`
  - Example (prod): `https://<your-cloudflare-tunnel-hostname>`

- `HEXCARB_GATEWAY_API_KEY`
  - The API key expected by the HexCarb gateway.
  - Fallback env name supported: `HEXCARB_API_KEY`

- `HEXCARB_CHAT_TIMEOUT_MS`
  - Timeout used by the `/api/chat` server route before failing over to the next model hint.
  - Default: `70000`

## Local Dev

```bash
cd hexcarb-web
npm run dev
```

Then open http://localhost:3000.

If you want to connect to a local engine, run the engine gateway first and set:
- `HEXCARB_GATEWAY_URL=http://127.0.0.1:8000`
- `HEXCARB_GATEWAY_API_KEY=...`

## Vercel Deploy

Recommended setup:
1. Put only this `hexcarb-web/` folder into a GitHub repo.
2. Import the repo in Vercel.
3. Set env vars in Vercel.
4. Deploy.

The engine gateway must be reachable from Vercel over HTTPS (commonly via a Cloudflare tunnel).
