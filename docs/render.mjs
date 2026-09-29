// The receiver. It reads the grammar and the document from the URL (query or
// fragment), validates the document against its grammar, and only then gives
// the canonical document to innerHTML. mode=raw shows the unvalidated html
// field as the original req.query.html sink did, but inside a sandboxed frame
// with no scripts and an opaque origin.

import { grammar } from "./lib/grammar.mjs";
import { readRenderUrl } from "./lib/speaker.mjs";

const $ = id => document.getElementById(id);

function fail(message) {
  $("meta").textContent = "Transmission rejected";
  $("error").hidden = false;
  $("error").textContent = message;
}

function render() {
  let r;
  try { r = readRenderUrl(location.href); } catch (error) { fail(`${error.name}: ${error.message}`); return; }
  $("speaker").textContent = r.speaker ? `${r.speaker}:${r.port}` : location.host;

  if (r.mode === "raw") {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.className = "raw-frame";
    frame.srcdoc = r.document;
    $("output").replaceChildren(frame);
    $("meta").textContent = `Raw innerHTML sink · ${r.document.length.toLocaleString("en-US")} characters · unvalidated, sandboxed`;
    return;
  }

  let g, decoded;
  try {
    g = grammar(r.grammarId);
    decoded = g.decode(r.document);
  } catch (error) { fail(`${error.name}: ${error.message}`); return; }

  $("output").innerHTML = r.document;
  $("output").dataset.form = g.form;
  $("meta").textContent = `${g.title} · ${decoded.bytes.length.toLocaleString("en-US")} validated tokens · ${r.carrier === "query" ? "query string" : "fragment"} carrier`;
  $("tools").hidden = false;
  $("labels").addEventListener("change", e => document.body.classList.toggle("show-labels", e.target.checked));
  if (g.form === "closed") $("labels").closest("label").hidden = true;
  else labelTokens(decoded.bytes);
  $("copyText").addEventListener("click", async () => {
    await navigator.clipboard.writeText(decoded.text);
    $("copyText").textContent = "Copied";
  });
}

// For payload-free grammars, mark each SPAN with its byte so it can be shown on request.
function labelTokens(bytes) {
  const spans = $("output").getElementsByTagName("span");
  const n = Math.min(spans.length, bytes.length);
  for (let i = 0; i < n; i += 1) spans[i].dataset.b = String.fromCharCode(bytes[i] < 0x20 || bytes[i] === 0x7f ? 0xb7 : bytes[i]);
}

addEventListener("hashchange", () => location.reload());
render();
