# Event Prep Reminder

Browser-based in-app reminder for event-day preparation. Keep the tab open on your prep laptop.

## Features

- Checklist with 3 preparation groups (media, backstage timer, video loops)
- Reminds every **15 or 20 minutes** until all items are checked
- Stops at configured **end time** (default **9:45 AM**)
- Final alert: **Be ready — the service is getting started. Remove the lyrics from the screen.**
- Persists progress locally and syncs across users when deployed with Vercel KV

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — data stays on this device unless you use `vercel dev` with KV linked.

For full shared-sync local testing:

```bash
npm run dev:vercel
```

## Deploy on Vercel (shared data for the whole team)

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. In the Vercel project, open **Storage** → add **Upstash Redis** from the [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis).
3. Link the Redis store to your project. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. Redeploy. Everyone opening the app URL sees the same checklist, timers, and notes.
5. Optional: set `SYNC_WRITE_KEY` in Vercel env vars and the same value as `VITE_SYNC_WRITE_KEY` at build time to require a shared token for writes.

The header badge shows **Shared** when sync is active, or **Local only** when KV is not configured.

## Production build

```bash
npm run build
npm run preview
```

## Test mode

Append `?test=1` to the URL for faster verification:

- Reminder interval: **1 minute**
- End time: **3 minutes** from page load
- Tick loop: every **5 seconds**

Example: `http://localhost:5173/?test=1`

## Event day usage

1. Open the app in a dedicated browser window.
2. Set end time (e.g. `09:45`).
3. Choose reminder interval (15 or 20 min).
4. Check off items as you complete them.
5. Leave the tab open until the service starts.
