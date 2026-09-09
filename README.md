# Soundwave — YouTube Audio Search

Soundwave is a React + TypeScript web app that searches YouTube from inside the page, displays live result metadata and thumbnails, and loads selected videos in the official YouTube embedded player.

> **Important:** This project does not download videos, extract MP3 files, or hide an embedded YouTube video to create an unofficial audio-only stream. Playback stays inside the official YouTube player to respect YouTube’s platform rules and creator rights.

## Features

- Search YouTube from the Soundwave interface without automatically navigating away.
- Server-side experimental parsing of the public YouTube mobile search HTML response.
- Live titles, thumbnails, channel names, durations, view counts, and publish-time labels.
- Loading, empty-result, and error states.
- Official YouTube embedded playback for selected live results.
- Reliable play/pause control through the YouTube iframe command API.
- Local favorites saved in browser storage; saving never downloads an audio file.
- Responsive dark editorial interface for desktop and mobile.
- Vercel configuration with a serverless tRPC API adapter.

## Requirements

- Node.js 20 or newer
- pnpm 10 or npm
- Internet access from the server runtime so the scraper can request YouTube

## Local setup

```bash
git clone <your-repository-url>
cd soundwave-youtube-audio
pnpm install
pnpm dev
```

Open the local URL printed by the dev server. The app does not require a YouTube API key for the experimental scraper path.

### Useful commands

```bash
pnpm check       # TypeScript validation
pnpm test        # Existing Vitest tests
pnpm build       # Vite frontend build plus server bundle
pnpm dev         # Local full-stack development server
```

## How live search works

The browser calls the public tRPC procedure `youtube.search`. The server requests:

```text
https://m.youtube.com/results?sp=mAEA&search_query=USER_INPUT
```

The parser reads the embedded `ytInitialData` object and returns the first live video renderers. YouTube can change this internal HTML/JSON structure or block automated requests at any time. If results stop loading, the recommended production solution is to replace the scraper with the official YouTube Data API v3.

The parser lives in `server/youtube-scraper.ts`, the public procedure is in `server/routers.ts`, and the UI is in `client/src/pages/Home.tsx`.

## Vercel deployment

This repository includes `vercel.json` and `api/index.ts`.

### Deploy with the Vercel dashboard

1. Push the project to GitHub, GitLab, or Bitbucket.
2. Import the repository into Vercel.
3. Vercel should detect the configuration automatically.
4. Use these project settings if Vercel asks:
   - **Build command:** `pnpm build`
   - **Output directory:** `dist/public`
   - **Install command:** `pnpm install`
5. Deploy.

### Deploy with the Vercel CLI

```bash
pnpm add --global vercel
vercel login
vercel
vercel --prod
```

The serverless endpoint is available at:

```text
https://YOUR_DOMAIN/api/health
```

A successful response is:

```json
{"ok":true,"service":"soundwave-api"}
```

The frontend calls `/api/trpc`, so no public API URL needs to be configured.

## Environment variables

The live scraper does not require a YouTube API key. The upgraded project template also supports these optional server variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Session cookie signing for the included Manus auth plumbing |
| `VITE_APP_ID` | Manus OAuth application ID, if auth is enabled |
| `OAUTH_SERVER_URL` | Manus OAuth server URL, if auth is enabled |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth portal URL, if auth is enabled |
| `DATABASE_URL` | MySQL/TiDB connection string, if database features are enabled |
| `OWNER_OPEN_ID` | Owner identity for the included auth template |
| `BUILT_IN_FORGE_API_URL` | Optional Manus built-in API base URL |
| `BUILT_IN_FORGE_API_KEY` | Optional server-side Manus built-in API key |

Do not put secrets in `VITE_*` variables unless they are intentionally public. Vercel environment variables should be added in **Project Settings → Environment Variables**.

## Vercel notes

- The frontend is emitted to `dist/public` by `pnpm build`.
- `api/index.ts` is a Vercel Node serverless function that serves the tRPC endpoint.
- `vercel.json` rewrites `/api/*` to the function and routes the remaining paths to the SPA entry point.
- Serverless scraping has request and execution limits. For higher traffic, use the official YouTube Data API and add caching/rate limiting.

## Project structure

```text
client/src/pages/Home.tsx   Main Soundwave UI
client/src/index.css        Visual system and responsive styles
server/youtube-scraper.ts   YouTube HTML parser and fetcher
server/routers.ts           Public tRPC search procedure
api/index.ts                Vercel serverless API adapter
vercel.json                 Vercel build and rewrite configuration
```

## License and usage

Review YouTube’s current Terms of Service, API Services Terms, and content rights requirements before operating this project publicly. Use the official YouTube embed for playback and respect creator, copyright, rate-limit, and robots/policy requirements.
