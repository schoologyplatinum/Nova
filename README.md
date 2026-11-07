# Nova Proxy — GitHub + jsDelivr frontend, Render backend

## Important limitations
This is a restricted HTML page viewer, not a full CroxyProxy clone. It only fetches domains listed in `ALLOWED_HOSTS`, sanitizes returned HTML, and disables scripts/forms/interactive content. It will not run many modern web apps, login pages, video sites, or arbitrary downloads. Do not remove the allowlist or turn this into an unrestricted public proxy.

## Deploy backend on Render
1. Push this repository to GitHub.
2. In Render, create **New + → Web Service**, connect this repository.
3. Set Runtime to **Node**; Build Command `npm install`; Start Command `npm start`.
4. Add environment variables:
   - `ALLOWED_HOSTS`: comma-separated exact hostnames you have permission to retrieve, e.g. `example.com,www.example.com`
   - `FRONTEND_ORIGIN`: `https://cdn.jsdelivr.net`
5. Deploy. Copy the Render URL, e.g. `https://nova-proxy-xxxx.onrender.com`.
6. Test `https://YOUR-RENDER-URL/health` and confirm it returns `{"ok":true}`.

## Connect the jsDelivr frontend
1. Edit `public/index.html` in GitHub.
2. Find `const BACKEND_URL = "https://YOUR-RENDER-SERVICE.onrender.com";`
3. Replace it with your real Render URL (no trailing slash).
4. Commit the change.
5. Open:
   `https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY@main/public/index.html`
   Replace the username and repository name. Allow a minute for CDN cache to update.

## Notes
- Render free services may sleep when idle and take time to wake.
- jsDelivr serves static files only; it cannot execute `server.js`.
- Keep Render bound to `0.0.0.0` and use the platform-provided `PORT`.
- `FRONTEND_ORIGIN=https://cdn.jsdelivr.net` is required for browser cross-origin requests to `/api/config`. The proxied page is loaded as a direct iframe navigation.
