# url2md

Minimal Cloudflare web tool for `url2md`.

## What it does

- top URL input
- editable raw Markdown on the left
- rendered Markdown preview on the right

## Repo

- `frontend/`: React + Vite app for Cloudflare Pages
- `worker/`: Cloudflare Worker API
- `worker/patches/`: `patch-package` fixes for `@cloudflare/puppeteer`

## Requirements

- Cloudflare account
- `workers.dev` subdomain configured
- Browser Rendering enabled for the Worker

## Local dev

Recommended for normal use: run the frontend locally and point it at the deployed Worker.

```bash
cd frontend
npm install
VITE_API_BASE_URL="https://<your-worker>.workers.dev" npm run dev
```

If you are changing backend code too, run both locally.

Worker:

```bash
cd worker
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

- local Worker runs on `http://127.0.0.1:8787`
- frontend dev URL is usually `http://127.0.0.1:5173`
- local Worker uses static capture only
- deployed Worker uses static + rendered capture

## Deploy

Worker:

- Worker name is set in `worker/wrangler.jsonc`
- current name: `url2md`

```bash
cd worker
npx wrangler deploy
```

Cloudflare Pages Git setup:

- root directory: `frontend`
- build command: `npm run build`
- build output directory: `dist`
- env var: `VITE_API_BASE_URL=https://<your-worker>.workers.dev`

Cloudflare Workers Builds Git setup:

- root directory: `worker`
