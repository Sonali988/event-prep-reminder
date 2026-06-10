# Event Prep Reminder

Browser-based in-app reminder for event-day preparation. Keep the tab open on your prep laptop.

## Features

- Checklist with 3 preparation groups (media, backstage timer, video loops)
- Reminds every **15 or 20 minutes** until all items are checked
- Stops at configured **end time** (default **9:45 AM**)
- Final alert: **Be ready — the service is getting started. Remove the lyrics from the screen.**
- Persists progress in `localStorage`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

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
