# url2md-web

Minimal Cloudflare web UI for `url2md`.

## What it does

- top URL input
- editable raw Markdown on the left
- rendered Markdown preview on the right

## Repo

- `frontend/`: React + Vite app for Cloudflare Pages
- `worker/`: Cloudflare Worker API
- `worker/patches/`: local patch-package fixes for `@cloudflare/puppeteer`

## Requirements

- Cloudflare account
- `workers.dev` subdomain configured
- Browser Rendering available for the Worker

## Local dev

Worker:

```bash
cd worker
npm install
npm run dev
```

Worker runs on `http://127.0.0.1:8787`.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

- Frontend dev URL is usually `http://127.0.0.1:5173`
- local dev uses static capture only
- deployed Worker uses static + rendered capture

## Deploy

Worker:

```bash
cd worker
npx wrangler deploy
```

Git-integrated Cloudflare setup:

- Cloudflare Pages root directory: `frontend`
- Cloudflare Pages build command: `npm run build`
- Cloudflare Pages build output directory: `dist`
- Cloudflare Pages env var: `VITE_API_BASE_URL=https://<your-worker-url>`
- Cloudflare Workers Builds root directory: `worker`
