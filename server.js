const express = require("express");
const helmet = require("helmet");
const sanitizeHtml = require("sanitize-html");
const dns = require("node:dns/promises");
const net = require("node:net");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "example.com,www.example.com,poki.com,https://poki.com")
  .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.static(path.join(__dirname, "public")));

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    return s === "::1" || s === "::" || s.startsWith("fc") ||
      s.startsWith("fd") || s.startsWith("fe80:") || s.startsWith("::ffff:127.");
  }
  return true;
}
function hostAllowed(host) {
  const h = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some(allowed => h === allowed || h.endsWith("." + allowed));
}
async function validateTarget(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites are supported.");
  if (url.username || url.password) throw new Error("URLs containing usernames or passwords are not supported.");
  if (!hostAllowed(url.hostname)) throw new Error("This domain is not on the server allowlist. Add it to ALLOWED_HOSTS in your hosting settings.");
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(r => isPrivateAddress(r.address))) {
    throw new Error("The destination resolves to a private or restricted network address.");
  }
  return url;
}
function proxyUrl(url) {
  return "/browse?url=" + encodeURIComponent(url.toString());
}
function escapeText(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
app.get("/api/config", (_req, res) => res.json({ allowedHosts: ALLOWED_HOSTS }));

app.get("/browse", async (req, res) => {
  try {
    let target = await validateTarget(String(req.query.url || ""));
    let response;
    for (let hop = 0; hop < 5; hop++) {
      response = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SafePageViewer/1.0)", "Accept": "text/html,application/xhtml+xml" }
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) break;
        target = await validateTarget(new URL(location, target).toString());
        continue;
      }
      break;
    }
    if (!response) throw new Error("The destination did not respond.");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      return res.status(415).send("This viewer currently supports HTML pages only. Destination returned: " + type);
    }
    if (!response.ok) return res.status(response.status).send("Destination returned HTTP " + response.status);
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 3 * 1024 * 1024) { await reader.cancel(); throw new Error("Page exceeds the 3 MB viewer limit."); }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    const base = target.toString();
    const clean = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img","h1","h2","h3","h4","figure","figcaption","picture","source",
        "video","audio","summary","details","main","header","footer","nav",
        "section","article","span"
      ]),
      allowedAttributes: {
        "*": ["class","id","title","lang","dir"],
        "a": ["href","name","target","rel"],
        "img": ["src","alt","width","height","loading"],
        "source": ["src","type","media"],
        "video": ["controls","poster","width","height"],
        "audio": ["controls"],
        "td": ["colspan","rowspan"], "th": ["colspan","rowspan","scope"]
      },
      allowedSchemes: ["http","https","mailto"],
      transformTags: {
        "a": (_tag, attrs) => {
          let href = attrs.href || "";
          try { if (href && !href.startsWith("mailto:")) href = proxyUrl(new URL(href, base)); } catch { href = "#"; }
          return { tagName: "a", attribs: { href, rel: "noopener noreferrer" } };
        },
        "img": (_tag, attrs) => {
          let src = attrs.src || "";
          try { if (src) src = new URL(src, base).toString(); } catch { src = ""; }
          return { tagName: "img", attribs: { ...attrs, src, loading: "lazy" } };
        }
      },
      disallowedTagsMode: "discard"
    });
    res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <base target="_self"><title>${escapeText(target.hostname)}</title>
      <style>body{font:16px/1.55 system-ui,sans-serif;max-width:1100px;margin:30px auto;padding:0 20px;color:#20232a}
      img,video{max-width:100%;height:auto}a{color:#5265dc}pre{white-space:pre-wrap;overflow-wrap:anywhere}
      table{max-width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid #ddd}</style></head><body>
      <div style="padding:10px 14px;background:#f1f3ff;border-radius:10px;margin-bottom:20px;font:13px system-ui">
      Safe viewer mode · scripts, forms, and active embedded content are disabled · <a href="${FRONTEND_ORIGIN === "*" ? "/" : FRONTEND_ORIGIN}">Return to proxy</a></div>${clean}</body></html>`);
  } catch (err) {
    res.status(400).type("text").send(err.message || "Unable to load this page.");
  }
});
app.get("/health", (_req,res) => res.json({ ok: true }));
app.listen(PORT, HOST, () => console.log(`Nova Proxy backend listening on ${HOST}:${PORT}`));
