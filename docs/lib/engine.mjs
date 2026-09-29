// Runs an MDQNM namespace in this page, with the Alien Corridor Support System's
// in-browser engine: SCI (scittle 0.8.33) evaluates the engine's unmodified .clj
// sources, and acss-engine.js supplies what the JVM supplied. Both scripts are
// vendored in vendor/; the sources are read from the Alien Corridor site, which
// publishes them byte for byte.

export const TARGET_NAMESPACE = "org.threeppnoah.mdqnm.jomosuperprocess1.mdqnm-timemachines-and-clocks";
export const ENGINE_SITE = "https://nth-member.github.io/alien-corridor/";

const REQ = /\(require\s+'([A-Za-z0-9.\-]+)\s*:reload\)/g;
let scriptsReady = null;
const sessions = new Map();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(el);
  });
}

async function text(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function session(site, tree) {
  const key = `${site}|${tree}`;
  if (!sessions.has(key)) {
    sessions.set(key, (async () => {
      scriptsReady ??= loadScript(new URL("../vendor/scittle-0.8.33.js", import.meta.url).href)
        .then(() => loadScript(new URL("../vendor/acss-engine.js", import.meta.url).href));
      await scriptsReady;
      const list = JSON.parse(await text(`${site}data/namespaces-${tree}.json`));
      return { site, tree, paths: new Map(list.map(n => [n.ns, n.path])), sources: new Map(), engine: null };
    })().catch(error => { sessions.delete(key); throw error; }));
  }
  return sessions.get(key);
}

// Fetches the namespace and everything it requires, so that the load itself,
// which is synchronous, finds every source at hand. Each level of requires is
// fetched in parallel.
async function closure(s, ns, onStatus) {
  const seen = new Set([ns]);
  let level = [ns];
  while (level.length) {
    await Promise.all(level.filter(n => !s.sources.has(n)).map(async n => {
      s.sources.set(n, await text(`${s.site}engine/${s.tree}/${s.paths.get(n)}`));
      onStatus?.(`Reading the engine's sources: ${s.sources.size} of ${seen.size}+`);
    }));
    const next = [];
    for (const n of level) {
      for (const m of s.sources.get(n).matchAll(REQ)) {
        if (s.paths.has(m[1]) && !seen.has(m[1])) { seen.add(m[1]); next.push(m[1]); }
      }
    }
    level = next;
  }
}

export async function runNamespace(ns = TARGET_NAMESPACE, { site = ENGINE_SITE, tree = "primary", onStatus } = {}) {
  const s = await session(site, tree);
  if (!s.paths.has(ns)) throw new Error(`${ns} is not in the ${tree} tree`);
  await closure(s, ns, onStatus);
  s.engine ??= window.ACSS.Engine({ isEngineNs: n => s.paths.has(n), source: n => s.sources.get(n) ?? null });
  onStatus?.(`Evaluating ${ns} (${s.sources.size} namespaces)…`);
  await new Promise(r => setTimeout(r, 30));
  const result = s.engine.load(ns);
  if (!result.ok) throw new Error(`${result.error}\n${result.out.slice(-2000)}`);
  return { out: result.out, ms: result.ms, engine: `SCI via scittle 0.8.33 (${tree} tree, in this page)` };
}
