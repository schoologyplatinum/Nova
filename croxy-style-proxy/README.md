# Nova Proxy — restricted web page viewer

A small Node.js + HTML project with a CroxyProxy-inspired address bar and viewer.

## Important limitation

This is **not a full CroxyProxy clone**. It fetches HTML pages on the server, removes scripts and forms, and rewrites ordinary links back through the viewer. It does not support interactive websites, sign-ins, video streaming, arbitrary downloads, WebSockets, or every CSS/resource path. Modern sites may not render correctly.

The allowlist is intentional: do not turn this into an unrestricted public proxy. Keep it on localhost for personal testing, or protect it with a strong key and only allow domains you control or are authorized to access.

## Run locally

1. Install Node.js 20 or newer.
2. Extract the project.
3. Open a terminal in this folder.
4. Run:

   ```bash
   npm install
   ```

5. Copy `.env.example` to `.env` (or set the same environment variables in your shell).
6. Edit `ALLOWED_HOSTS` to include the exact hostnames you want to allow, comma-separated. Example:

   ```env
   ALLOWED_HOSTS=example.com,www.example.com
   HOST=127.0.0.1
   PORT=3000
   ```

7. Start it:

   ```bash
   npm start
   ```

8. Open http://127.0.0.1:3000

## Allowlist behavior

`ALLOWED_HOSTS=example.com` permits `example.com` and its subdomains. It does not permit unrelated sites. Add each required domain explicitly, e.g. `example.com,example.org,www.example.net`.

## Public hosting

If you bind to `0.0.0.0` or deploy to a public host, set a long random `PROXY_KEY` and add authentication at your hosting layer. This sample checks `X-Proxy-Key` on `/browse`; for a public deployment, extend the UI to send that key securely and use HTTPS. Do not publish a public unauthenticated proxy.

## Project structure

- `server.js` — Node.js server and restricted fetch/HTML sanitization
- `public/index.html` — responsive browser interface
- `.env.example` — configuration template
