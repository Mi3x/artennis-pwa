# CourtVision PWA

Installable Progressive Web App for CourtVision — the AI tennis match-tracking SaaS (courtvision.app).

## Files
```
index.html      app shell — live court replay, analytics, analyze tabs
manifest.json   install metadata (name, icons, theme, shortcuts)
sw.js           service worker — offline app-shell caching
icons/          192px + 512px app icons (512 is maskable)
```

## Run locally
PWAs require HTTPS or localhost for the service worker:

```bash
npx serve .          # or: python3 -m http.server 8080
```
Open http://localhost:3000 — after the first load the app works fully offline.
On Chrome/Edge an **Install app** button appears in the header (and in the
address bar); on iOS Safari use Share → Add to Home Screen.

## Deploy
Any static host works: Netlify, Vercel, GitHub Pages, Cloudflare Pages.
Drop the folder in as-is; no build step.

## Wire up the real tracker
The Analyze tab currently simulates processing. To connect the Python
pipeline from the `tennis_tracker` project:

1. Wrap `tennis_tracker.pipeline.process_video` in a small API
   (FastAPI: `POST /analyze` accepts the video, returns `rally_data.json`
   and a URL for the annotated MP4).
2. In `index.html`, replace `startAnalysis()`'s timer with a `fetch()`
   upload to that endpoint, then assign the response to `RALLY` and call
   `renderStats()` + `playReplay()` — the whole UI is driven by that one
   object, so real data drops straight in.

## Notes
- Bump the `CACHE` version string in `sw.js` whenever you ship changes,
  so returning users get the new shell.
- The rally shown on first load is sample data from the tracking pipeline
  (shot speeds, bounce coordinates in court metres).
