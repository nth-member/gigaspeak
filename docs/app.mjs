import { GRAMMARS, DEFAULT_GRAMMAR, grammar, labelForByte, hex2 } from "./lib/grammar.mjs";
import { buildConstitution, defaultBudget, detectUrlLimit, readRenderUrl, FIREFOX_MAX_URL } from "./lib/speaker.mjs";
import { buildMessageUrl } from "./lib/url-builder.mjs";
import { toBytes, hexOf, prepare, apply, htmFilename, escapement, transformTitle, MAX_INPUT } from "./lib/communicator.mjs";
import { generate, randomSeed, MODELS } from "./lib/teletype.mjs";

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString("en-US");
const RENDER = new URL("render.html", location.href).href;
const store = {
  get(k) { try { return localStorage.getItem(`gigaspeak:${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`gigaspeak:${k}`, v); } catch { /* storage unavailable */ } }
};
function remember(id) {
  const el = $(id), v = store.get(id);
  if (v !== null && [...(el.options ?? [])].some(o => o.value === v && !o.disabled)) el.value = v;
  el.addEventListener("change", () => store.set(id, el.value));
}
function status(id, text, kind = "") { $(id).textContent = text; $(id).className = `status ${kind}`; }

// ---------- tabs ----------
const tabs = [...document.querySelectorAll("[role=tab]")];
function show(name) {
  for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === name));
  for (const p of document.querySelectorAll("[data-panel]")) p.hidden = p.dataset.panel !== name;
  store.set("tab", name);
  if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);
}
tabs.forEach(t => t.addEventListener("click", () => show(t.dataset.tab)));
const tabFromHash = () => (tabs.some(t => t.dataset.tab === location.hash.slice(1)) ? location.hash.slice(1) : null);
show(tabFromHash() ?? store.get("tab") ?? "speak");
addEventListener("hashchange", () => { const t = tabFromHash(); if (t) show(t); });

for (const id of ["sGrammar", "bGrammar", "aGrammar"]) {
  $(id).innerHTML = GRAMMARS.map(g => `<option value="${g.id}">${g.title}</option>`).join("");
  $(id).value = DEFAULT_GRAMMAR;
}

// ---------- local server (optional) ----------
let local = null;
fetch("api/status", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(s => {
  if (!s || s.app !== "Gigaspeak") return;
  local = s;
  $("sAuthority").querySelector("[value=literal]").disabled = false;
  if (s.jvm) $("sSource").querySelector("[value=jvm]").disabled = false;
  remember("sAuthority"); remember("sSource"); syncSpeak();
}).catch(() => {});

// ---------- this browser's address limit ----------
// Firefox refuses addresses longer than network.standard-url.max-length less 4;
// a raised setting is found here and used. Elsewhere the Firefox default applies.
const browserLimit = detectUrlLimit();
const limitNote = browserLimit && browserLimit > FIREFOX_MAX_URL
  ? `This Firefox accepts addresses of up to ${fmt(browserLimit)} characters (network.standard-url.max-length raised). A link longer than ${fmt(FIREFOX_MAX_URL)} opens only in a Firefox whose setting is raised as far.`
  : `Firefox accepts addresses of at most ${fmt(FIREFOX_MAX_URL)} characters by default (network.standard-url.max-length = 1,048,576, less 4). Raising that setting in about:config raises the limit; this page detects it on loading.`;
function tooLong(length) {
  const limit = browserLimit ?? FIREFOX_MAX_URL;
  return length > limit ? `The address is ${fmt(length)} characters; this browser accepts at most ${fmt(limit)}.` : "";
}

// ---------- speak ----------
["sGrammar", "sCarrier", "sAuthority", "sSource"].forEach(remember);
function syncSpeak() {
  $("sTextWrap").hidden = $("sSource").value !== "text";
  const auto = defaultBudget({ carrier: $("sCarrier").value, authority: $("sAuthority").value, renderBase: RENDER, browserLimit });
  $("sBudget").placeholder = `automatic: ${fmt(auto)}`;
  $("sBudgetNote").textContent = auto <= 8000
    ? "A query-string URL is sent to the server, and GitHub Pages refuses request targets longer than about 8,190 characters. Use the fragment carrier for long transmissions."
    : limitNote;
}
["sCarrier", "sAuthority", "sSource"].forEach(id => $(id).addEventListener("change", syncSpeak));
syncSpeak();

async function speakSource() {
  const source = $("sSource").value;
  if (source === "text") return { out: $("sText").value, engine: "text supplied in this page", ms: 0 };
  if (source === "jvm") {
    status("sStatus", "Running the namespace on the JVM engine…");
    const r = await (await fetch("api/jvm/load", { method: "POST" })).json();
    if (!r.ok) throw new Error(r.error);
    return { out: r.out, engine: `JVM, ${r.tree ?? "primary"} tree`, ms: r.ms };
  }
  const { runNamespace } = await import("./lib/engine.mjs");
  status("sStatus", "Loading the MDQNM engine…");
  return runNamespace(undefined, { onStatus: t => status("sStatus", t) });
}

let lastUrl = "";
$("speak").addEventListener("click", async () => {
  const button = $("speak");
  button.disabled = true; $("sFacts").hidden = true; $("sLinks").hidden = true;
  const t0 = performance.now();
  try {
    const src = await speakSource();
    status("sStatus", "Constituting the speaker…");
    const budgetText = $("sBudget").value.trim();
    const renderBase = $("sAuthority").value === "literal" ? new URL("render.html", local.origin + "/").href : RENDER;
    const c = await buildConstitution(src.out, {
      grammarId: $("sGrammar").value,
      carrier: $("sCarrier").value,
      authority: $("sAuthority").value,
      renderBase,
      maxUrlLength: budgetText ? Number.parseInt(budgetText, 10) : undefined,
      browserLimit
    });
    lastUrl = c.renderUrl;
    $("fIdentity").textContent = `${c.identity.address}:${c.identity.port}`;
    $("fOutput").textContent = `${fmt(c.outputCharacters)} ASCII characters${c.nonAsciiReplacements ? ` (${fmt(c.nonAsciiReplacements)} replaced by ?)` : ""} · SHA-256 ${c.outputSha256.slice(0, 16)}…`;
    $("fPortion").textContent = `${fmt(c.portionCharacters)} characters from offset ${fmt(c.portionStart)} · one of ${fmt(c.portionCandidates)} longest windows`;
    $("fUrl").textContent = `${fmt(c.urlLength)} of ${fmt(c.maxUrlLength)} characters · ${grammar(c.grammar).title}`;
    $("fEngine").textContent = `${src.engine}${src.ms ? ` · ${fmt(src.ms)} ms` : ""}`;
    $("fRun").textContent = c.runId;
    $("sFacts").hidden = false; $("sLinks").hidden = false;
    $("sOpen").href = c.renderUrl;
    const refusal = tooLong(c.urlLength);
    if (refusal) {
      status("sStatus", `${refusal} Lower the URL budget, or raise network.standard-url.max-length in about:config and reload.`, "error");
    } else if (c.authority === "literal") {
      const r = await (await fetch("api/literal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: c.renderUrl, port: c.identity.port }) })).json();
      if (!r.ok) throw new Error(r.error);
      status("sStatus", `Done in ${fmt(Math.round(performance.now() - t0))} ms. A proxied Firefox opened ${c.identity.address}:${c.identity.port}.`, "good");
    } else {
      status("sStatus", `Done in ${fmt(Math.round(performance.now() - t0))} ms. Opening the transmission.`, "good");
      let tab;
      // Without "noopener", which makes window.open return null even on success;
      // the opener link is cut by hand instead.
      try { tab = window.open(c.renderUrl, "_blank"); if (tab) tab.opener = null; }
      catch { throw new Error(`The browser refused the ${fmt(c.urlLength)}-character address as too long. Lower the URL budget.`); }
      if (!tab) status("sStatus", "Done. The browser blocked the new tab; use the link below.", "good");
    }
  } catch (error) {
    status("sStatus", error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("sCopy").addEventListener("click", () => copy(lastUrl, $("sCopy")));

async function copy(text, button) {
  try { await navigator.clipboard.writeText(text); button.textContent = "Copied"; }
  catch { button.textContent = "Copy failed"; }
  setTimeout(() => { button.textContent = "Copy URL"; }, 1500);
}

// ---------- build ----------
$("bTarget").value = RENDER;
["bGrammar", "bCarrier", "bMode", "bEol", "bFileAs"].forEach(remember);
// A file carried byte for byte (File goes: into the URL). While set, it replaces
// the message box, and Tokens and Line breaks do not apply.
let bRaw = null, bFileLast = null, bHref = "";
const URL_SHOWN = 200_000;   // characters of a very long address shown in the box
let bPending = 0;
function build() {
  cancelAnimationFrame(bPending);
  bPending = requestAnimationFrame(buildNow);
}
function buildNow() {
  try {
    const r = buildMessageUrl({
      message: $("bMessage").value, bytes: bRaw ?? undefined, target: $("bTarget").value, port: $("bPort").value,
      grammarId: $("bGrammar").value, carrier: $("bCarrier").value, mode: $("bMode").value, lineEnding: $("bEol").value
    });
    bHref = r.href;
    $("bUrl").value = r.length > URL_SHOWN
      ? `${r.href.slice(0, URL_SHOWN)}\n… ${fmt(r.length - URL_SHOWN)} more characters (Copy URL and Save URL .txt take the whole address)`
      : r.href;
    $("bLen").textContent = fmt(r.length); $("bOpen").href = r.href; $("bCount").textContent = fmt(r.bytes.length);
    $("bPreview").innerHTML = grammar($("bGrammar").value).encodeBytes(r.bytes.slice(0, 4000));
    $("bPreview").dataset.form = grammar($("bGrammar").value).form;
    // Lengths are reported, never enforced: the address is built in full.
    const notes = [];
    const hosted = !/^(localhost|127\.|\[::1\])/.test(r.hostname);   // not new URL(href): too long for it
    if (hosted && $("bCarrier").value === "query" && r.length > 8000) notes.push("GitHub Pages answers query addresses longer than about 8,190 characters with 414 URI Too Long; the address is not shortened");
    const limit = browserLimit ?? FIREFOX_MAX_URL;
    if (r.length > limit) notes.push(`this browser opens addresses of up to ${fmt(limit)} characters`);
    status("bStatus", `${fmt(r.bytes.length)} bytes${notes.length ? ` · ${notes.join(" · ")}` : ""}`);
  } catch (error) {
    bHref = ""; $("bUrl").value = ""; $("bLen").textContent = "0"; $("bPreview").textContent = "";
    status("bStatus", error.message, "error");
  }
}
["bMessage", "bTarget", "bPort", "bGrammar", "bCarrier", "bMode", "bEol"].forEach(id => $(id).addEventListener("input", build));
build();
$("bCopy").addEventListener("click", () => copy(bHref, $("bCopy")));
$("bSave").addEventListener("click", () => {
  if (bHref) save(`${(bFileLast?.name ?? "gigaspeak").replace(/\.\w+$/, "")}_url.txt`, new Blob([bHref], { type: "text/plain" }));
});

function bSetRaw(on, info = "") {
  $("bMessage").disabled = on; $("bMode").disabled = on; $("bEol").disabled = on;
  $("bRawRow").hidden = !on; $("bRawInfo").textContent = info;
}
function bApplyFile() {
  if (!bFileLast) return;
  const { bytes, name } = bFileLast;
  if ($("bFileAs").value === "raw") {
    bRaw = bytes;
    bSetRaw(true, `${name} · ${fmt(bytes.length)} bytes carried byte for byte (Tokens and Line breaks do not apply)`);
  } else {
    bRaw = null;
    bSetRaw(false);
    $("bMessage").value = new TextDecoder("ascii").decode(bytes);
    status("bStatus", `${name} placed in the message box: control mnemonics and Line breaks now apply to it`);
  }
  build();
}
$("bFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";                                   // the same file can be chosen again
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bad = bytes.findIndex(b => b > 0x7f);
  if (bad >= 0) { status("bStatus", `Byte ${fmt(bad + 1)} of ${file.name} is 0x${hex2(bytes[bad])}: only ASCII 00-7F can be carried.`, "error"); return; }
  bFileLast = { bytes, name: file.name };
  bApplyFile();
});
$("bFileAs").addEventListener("change", bApplyFile);
$("bRawClear").addEventListener("click", () => { bRaw = null; bFileLast = null; bSetRaw(false); build(); });

$("dUrl").addEventListener("input", () => {
  const v = $("dUrl").value.trim();
  if (!v) { $("dOut").textContent = ""; return; }
  try {
    const r = readRenderUrl(v);
    const d = grammar(r.grammarId).decode(r.document);
    $("dOut").textContent = `grammar  ${r.grammarId}\ncarrier  ${r.carrier}\nbytes    ${fmt(d.bytes.length)}\nhex      ${hexOf(d.bytes.slice(0, 256), 16)}${d.bytes.length > 256 ? " …" : ""}\ntext     ${JSON.stringify(d.text.slice(0, 2000))}`;
  } catch (error) { $("dOut").textContent = `${error.name}: ${error.message}`; }
});

// ---------- communicator ----------
let transforms = [], prepared = new Map(), cBytes = [], cOut = null;
// A raw byte source (a generated test stream, or an opened file). When set, it is
// the Communicator's input verbatim, bypassing the textarea (whose newline
// normalisation would corrupt a binary stream) and the control-token parser.
let cRaw = null;
const htmlLike = t => /htmlcolor/.test(t.namespace);
fetch("data/transforms.json").then(r => r.json()).then(data => {
  transforms = data.transforms;
  $("cTransform").innerHTML = transforms.map(t => `<option value="${t.id}">${transformTitle(t)}</option>`).join("");
  $("cTransform").value = "t09.1";
  remember("cTransform");
  communicate();
}).catch(error => status("cStatus", `Could not load the transforms: ${error.message}`, "error"));
["cMode", "cEol"].forEach(remember);

function transformNow() {
  const id = $("cTransform").value;
  if (!prepared.has(id)) prepared.set(id, prepare(transforms.find(t => t.id === id)));
  return prepared.get(id);
}

let pending = 0;
function communicate() {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    if (!transforms.length) return;
    try {
      cBytes = cRaw ?? toBytes($("cText").value, { lineEnding: $("cEol").value, mode: $("cMode").value });
      const t = transformNow();
      cOut = apply(t, cBytes);
      $("cCount").textContent = fmt(cBytes.length);
      $("cHex").textContent = hexOf(cBytes.slice(0, 4096), 16) + (cBytes.length > 4096 ? `\n… ${fmt(cBytes.length - 4096)} more bytes` : "");
      $("cOutHex").textContent = hexOf(cOut.slice(0, 2048), 16) + (cOut.length > 2048 ? `\n… ${fmt(cOut.length - 2048)} more bytes` : "");
      $("cOutInfo").textContent = `${fmt(cOut.length)} bytes · ${htmFilename($("cName").value)}`;
      if (htmlLike(t)) {
        $("cPreview").hidden = false;
        $("cPreview").innerHTML = new TextDecoder("latin1").decode(apply(t, cBytes.slice(0, 2000)));
      } else $("cPreview").hidden = true;
      status("cStatus", `${t.namespace} · ${t.alphabet}-entry map · source SHA-256 ${t.sourceSha256.slice(0, 16)}…`);
      $("cDownload").disabled = false;
    } catch (error) {
      cOut = null; $("cDownload").disabled = true;
      status("cStatus", error.message, "error");
    }
  });
}
["cTransform", "cMode", "cEol", "cName"].forEach(id => $(id).addEventListener("input", communicate));
$("cText").addEventListener("input", () => { if (cRaw) clearRaw(false); communicate(); });

// ---------- test-input generators (Teletype Model 33 / 37) ----------
function showRaw(info, generated) {
  $("cText").disabled = true;
  $("cRawRow").hidden = false;
  $("cRawInfo").textContent = info;
  $("cGenNew").hidden = !generated;
}
function clearRaw(run = true) {
  cRaw = null;
  $("cText").disabled = false;
  $("cRawRow").hidden = true;
  $("cGen").value = "";
  if (run) communicate();
}
function genTest() {
  const model = $("cGen").value;
  if (!model) { clearRaw(); return; }
  try {
    const seed = randomSeed();
    const { bytes, sessions } = generate(model, { seed });      // 1 MiB, 72 cols, high bit 0
    cRaw = bytes;
    $("cName").value = MODELS[model].file.replace(/\.txt$/, `_${seed}`);
    showRaw(`${MODELS[model].title} · ${fmt(bytes.length)} bytes · ${fmt(sessions.length)} sessions · seed ${seed} · every byte 00–7F (leading zero kept)`, true);
    communicate();
  } catch (error) {
    status("cStatus", error.message, "error");
  }
}
$("cGen").addEventListener("change", genTest);
$("cGenNew").addEventListener("click", () => { if ($("cGen").value) genTest(); });
$("cRawClear").addEventListener("click", () => clearRaw());
$("cRawSave").addEventListener("click", () => {
  if (cRaw) save(`${$("cName").value.trim() || "test"}.txt`, new Blob([cRaw], { type: "text/plain" }));
});

function save(name, blob) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
$("cDownload").addEventListener("click", () => {
  if (cOut) save(htmFilename($("cName").value), new Blob([cOut], { type: "application/octet-stream" }));
});
$("cHexSave").addEventListener("click", () => {
  const eol = { CRLF: "\r\n", LF: "\n", CR: "\r" }[$("cEol").value];
  const grid = escapement(hex2).map(r => r.join(" ")).join(eol);
  save(`${($("cName").value.trim() || "communicator").replace(/\.\w+$/, "")}_hex.txt`, new Blob([grid + eol + eol + hexOf(cBytes, 16).replace(/\n/g, eol) + eol], { type: "text/plain" }));
});
$("cFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bad = bytes.findIndex(b => b > 0x7f);
  if (bad >= 0) { status("cStatus", `Byte ${fmt(bad + 1)} is 0x${hex2(bytes[bad])}: the file is not ASCII.`, "error"); return; }
  if (bytes.length > MAX_INPUT) { status("cStatus", "The file is longer than 2,000,000 bytes.", "error"); return; }
  cRaw = bytes;
  $("cName").value = file.name.replace(/\.\w+$/, "");
  showRaw(`${file.name} · ${fmt(bytes.length)} bytes · opened verbatim`, false);
  communicate();
});
$("cEsc").innerHTML = `<table>${escapement().map((row, r) => `<tr>${row.map((cell, c) => `<td><b>${hex2(c * 16 + r)}</b>${cell.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</td>`).join("")}</tr>`).join("")}</table>`;

// ---------- grammars ----------
$("gTable").innerHTML = `<thead><tr><th>Grammar</th><th>Colours</th><th>Tokens</th><th>Display</th><th>"A" (0x41)</th></tr></thead><tbody>${
  GRAMMARS.map(g => `<tr><td><b>${g.title}</b><br><small>${g.source}</small></td><td>${g.colors === "rgba" ? "#RRGGBBAA" : "#RRGGBB"}</td><td>${{ closed: "closed, with label", open: "opening only (nest)", empty: "closed, empty" }[g.form]}</td><td>${g.display}</td><td><code>${grammar(g.id).tokenForByte(0x41).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</code></td></tr>`).join("")
}</tbody>`;
function chart() {
  const g = grammar($("aGrammar").value);
  $("aChart").innerHTML = Array.from({ length: 128 }, (_, b) => {
    const { foreground, background } = g.colorsForByte(b);
    return `<div class="cell" style="color:${foreground};background:${background}" title="0x${hex2(b)} ${labelForByte(b)} · ${foreground} on ${background}"><i>${hex2(b)}</i>${labelForByte(b).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</div>`;
  }).join("");
}
$("aGrammar").addEventListener("change", chart);
chart();
