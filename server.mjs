#!/usr/bin/env node
// Optional local server for Gigaspeak. The site in docs/ is complete without it;
// this adds what a static host cannot do:
//
//   literal authority  A proxied Firefox profile sends every request to this
//                      server, so http://A.B.C.D:PORT/render.html?… (a random,
//                      unassigned address) is shown in the address bar and served
//                      from docs/ here.
//   JVM engine         POST /api/jvm/load runs the namespace on an Alien Corridor
//                      Support System already running at GIGASPEAK_ENGINE_ORIGIN
//                      (default http://127.0.0.1:7777), when one is.
//
//   node server.mjs            then open http://127.0.0.1:8814/
//   GIGASPEAK_PORT=9000 node server.mjs

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.GIGASPEAK_PORT ?? "8814", 10);
const ORIGIN = `http://${HOST}:${PORT}`;
const ENGINE_ORIGIN = process.env.GIGASPEAK_ENGINE_ORIGIN ?? "http://127.0.0.1:7777";
const TARGET_NAMESPACE = "org.threeppnoah.mdqnm.jomosuperprocess1.mdqnm-timemachines-and-clocks";
const ROOT = fileURLToPath(new URL("./docs/", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml"
};

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
}
const json = (res, status, value) => send(res, status, "application/json; charset=utf-8", JSON.stringify(value));

async function body(req, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new RangeError("Request body too large"); chunks.push(c); }
  return Buffer.concat(chunks).toString("utf8");
}

async function jvmMeta() {
  try {
    const r = await fetch(`${ENGINE_ORIGIN}/api/meta`, { signal: AbortSignal.timeout(1500) });
    const m = await r.json();
    return m.app === "Alien Corridor Support System" ? m : null;
  } catch { return null; }
}

async function jvmLoad() {
  const meta = await jvmMeta();
  if (!meta) throw new Error(`No Alien Corridor Support System is answering at ${ENGINE_ORIGIN}`);
  const r = await fetch(`${ENGINE_ORIGIN}/api/load`, {
    method: "POST",
    headers: { "Content-Type": "application/edn; charset=utf-8" },
    body: `{:ns "${TARGET_NAMESPACE}"}`,
    signal: AbortSignal.timeout(15 * 60_000)
  });
  const result = await r.json();
  if (!result.ok) throw new Error(result.error ?? "MDQNM load failed");
  return { ok: true, out: result.out ?? "", ms: result.ms, tree: meta.tree };
}

function firefoxPrefs(randomPort) {
  return [
    'user_pref("network.proxy.type", 1);',
    `user_pref("network.proxy.http", "${HOST}");`,
    `user_pref("network.proxy.http_port", ${PORT});`,
    'user_pref("network.proxy.no_proxies_on", "127.0.0.1, localhost");',
    `user_pref("network.security.ports.banned.override", "${randomPort}");`,
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.startup.page", 0);',
    'user_pref("browser.sessionstore.resume_from_crash", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    ""
  ].join("\n");
}

async function openLiteral({ url, port }) {
  const target = new URL(url);
  if (target.protocol !== "http:" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(target.hostname)) throw new RangeError("Literal URLs are http://A.B.C.D:PORT/…");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError("Bad port");
  const profile = await mkdtemp(join(tmpdir(), "gigaspeak-firefox-"));
  await writeFile(join(profile, "user.js"), firefoxPrefs(port), "utf8");
  const browser = spawn("firefox", ["--no-remote", "--new-instance", "--profile", profile, url], { detached: true, stdio: "ignore" });
  await new Promise((resolve, reject) => { browser.once("spawn", resolve); browser.once("error", reject); });
  browser.once("exit", () => { rm(profile, { recursive: true, force: true }).catch(() => {}); });
  browser.unref();
}

async function file(res, pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "") || "index.html";
  const full = join(ROOT, rel.endsWith(sep) || rel.endsWith("/") ? `${rel}index.html` : rel);
  if (!full.startsWith(ROOT)) { send(res, 403, "text/plain; charset=utf-8", "Forbidden\n"); return; }
  try {
    send(res, 200, TYPES[extname(full)] ?? "application/octet-stream", await readFile(full));
  } catch {
    send(res, 404, "text/plain; charset=utf-8", "Not found\n");
  }
}

const server = createServer({ maxHeaderSize: 2 * 1024 * 1024 }, async (req, res) => {
  try {
    // A proxied request arrives in absolute form (http://A.B.C.D:PORT/path); it is
    // served from docs/ like any other.
    const url = new URL(req.url, ORIGIN);
    if (url.pathname === "/api/status" && req.method === "GET") {
      json(res, 200, { app: "Gigaspeak", ok: true, origin: ORIGIN, jvm: Boolean(await jvmMeta()) });
      return;
    }
    if (req.method === "POST" && req.headers.origin && req.headers.origin !== ORIGIN) {
      json(res, 403, { ok: false, error: "Cross-origin request refused" });
      return;
    }
    if (url.pathname === "/api/jvm/load" && req.method === "POST") {
      try { json(res, 200, await jvmLoad()); } catch (error) { json(res, 502, { ok: false, error: error.message }); }
      return;
    }
    if (url.pathname === "/api/literal" && req.method === "POST") {
      try { await openLiteral(JSON.parse(await body(req))); json(res, 200, { ok: true }); }
      catch (error) { json(res, 400, { ok: false, error: error.message }); }
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") { send(res, 405, "text/plain; charset=utf-8", "Method not allowed\n"); return; }
    await file(res, url.pathname);
  } catch (error) {
    send(res, 400, "text/plain; charset=utf-8", `${error.name}: ${error.message}\n`);
  }
});

server.listen(PORT, HOST, () => console.log(`Gigaspeak: ${ORIGIN}/`));
