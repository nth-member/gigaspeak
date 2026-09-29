import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import test from "node:test";

const PORT = 18000 + Math.floor(Math.random() * 1000);

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: PORT, path, headers }, res => {
      let body = "";
      res.on("data", c => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("local server: static site, status, proxied literal authority, containment", async t => {
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url), env: { ...process.env, GIGASPEAK_PORT: String(PORT), GIGASPEAK_ENGINE_ORIGIN: "http://127.0.0.1:1" }, stdio: "ignore"
  });
  t.after(() => server.kill());
  for (let i = 0; i < 50; i += 1) {
    try { await get("/api/status"); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  const status = JSON.parse((await get("/api/status")).body);
  assert.equal(status.app, "Gigaspeak");
  assert.equal(status.jvm, false);
  assert.match((await get("/")).body, /<title>Gigaspeak<\/title>/);
  const proxied = await get("http://203.0.113.9:4242/render.html?g=span-zero&html=", { host: "203.0.113.9:4242" });
  assert.equal(proxied.status, 200);
  assert.match(proxied.body, /Gigaspeak renderer/);
  assert.equal((await get("/lib/grammar.mjs")).type, "text/javascript; charset=utf-8");
  for (const path of ["/../server.mjs", "/%2e%2e/server.mjs", "/..%2Fserver.mjs", "/%2F..%2F..%2Fpackage.json"]) {
    assert.notEqual((await get(path)).status, 200, path);
  }
});
