// The Random Gigamonkey Speaker's constitution, shared by the browser and Node.
//
// One constitution: take the speaker's source text (normally the output of the
// MDQNM namespace mdqnm-timemachines-and-clocks), make it 7-bit ASCII, draw a
// random four-octet identity and port, choose uniformly at random one of the
// longest windows of the text whose encoded form fits the URL budget, and
// build the render URL for the chosen grammar, carrier and authority.
//
// The 24 original editions are the 6 grammars x 2 carriers x 2 authorities:
//   carrier    "query"     render.html?g=…&html=…#speaker=…   (sent to the server)
//              "fragment"  render.html?g=…#html=…&speaker=…   (never leaves the browser)
//   authority  "loopback"  the page's own origin renders; A.B.C.D:PORT is identity only
//              "literal"   http://A.B.C.D:PORT/ is the address itself (local server only)

import { grammar } from "./grammar.mjs";

// The longest address Firefox accepts by default. Its setting
// network.standard-url.max-length is 1,048,576, and its URL parser accepts at
// most that value less 4 (measured on Firefox 155, at 1, 4 and 8 MiB). A longer
// address is refused outright: window.open and location assignment throw.
export const FIREFOX_MAX_URL = 1_048_572;
// GitHub Pages answers 414 above ~8,190 characters of request target.
export const HOSTED_QUERY_MAX_URL = 8_000;

const cryptoRef = globalThis.crypto;

// Unbiased integer in [0, maxExclusive) from the platform CSPRNG.
export function randomBelow(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 32) {
    throw new RangeError("Random upper bound must be an integer from 1 through 2^32");
  }
  const limit = 2 ** 32 - (2 ** 32 % maxExclusive);
  let word;
  do word = nextWord(); while (word >= limit);
  return word % maxExclusive;
}

// CSPRNG words drawn 4,096 at a time: the window sampler may need millions.
const pool = new Uint32Array(4096);
let poolIndex = pool.length;
function nextWord() {
  if (poolIndex === pool.length) { cryptoRef.getRandomValues(pool); poolIndex = 0; }
  return pool[poolIndex++];
}

function randomUUID() {
  return cryptoRef.randomUUID();
}

export function constituteIdentity({ random = randomBelow } = {}) {
  const octets = Object.freeze(Array.from({ length: 4 }, () => random(256)));
  const port = random(65_536);
  return Object.freeze({ octets, address: octets.join("."), port });
}

export function normalizeAscii(input) {
  if (typeof input !== "string") throw new TypeError("source text must be a string");
  let replacements = 0;
  const text = input.replace(/[^\x00-\x7F]/gu, () => { replacements += 1; return "?"; });
  return Object.freeze({ text, replacements });
}

// Longest windows of text whose encoded length fits the budget; one is chosen
// uniformly at random among all of them by reservoir sampling.
export function selectMaximumWindow(text, encodedBudget, g, { random = randomBelow } = {}) {
  if (typeof text !== "string" || /[^\x00-\x7F]/.test(text)) throw new TypeError("text must contain only 7-bit ASCII");
  if (!Number.isSafeInteger(encodedBudget) || encodedBudget < 0) throw new RangeError("encodedBudget must be a non-negative integer");
  if (text.length === 0) return Object.freeze({ start: 0, length: 0, text: "", encodedLength: 0, candidates: 1 });

  const lengths = Array.from({ length: 128 }, (_, b) => g.encodedTokenLength(b));
  const weight = index => lengths[text.charCodeAt(index)];
  let left = 0, total = 0, bestStart = 0, bestLength = 0, bestEncoded = 0, candidates = 0;
  for (let right = 0; right < text.length; right += 1) {
    total += weight(right);
    while (left <= right && total > encodedBudget) { total -= weight(left); left += 1; }
    const length = right - left + 1;
    if (length > bestLength) {
      bestStart = left; bestLength = length; bestEncoded = total; candidates = 1;
    } else if (length === bestLength && length > 0) {
      candidates += 1;
      if (random(candidates) === 0) { bestStart = left; bestEncoded = total; }
    }
  }
  return Object.freeze({
    start: bestStart,
    length: bestLength,
    text: text.slice(bestStart, bestStart + bestLength),
    encodedLength: bestEncoded,
    candidates: Math.max(candidates, 1)
  });
}

export async function sha256(text) {
  const digest = await cryptoRef.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

// The longest address this browser's URL parser accepts, found by bisection, or
// null when it accepts everything up to `upper` (browsers other than Firefox,
// and Node). In Firefox it reflects a raised network.standard-url.max-length.
export function detectUrlLimit({ parse = u => new URL(u), upper = 16_777_216 } = {}) {
  const prefix = "https://a.example/#";
  const ok = n => { try { parse(prefix + "x".repeat(n - prefix.length)); return true; } catch { return false; } };
  if (ok(FIREFOX_MAX_URL) && !ok(FIREFOX_MAX_URL + 1)) return FIREFOX_MAX_URL;
  if (ok(upper)) return null;
  let lo = 1024, hi = upper;
  if (!ok(lo)) return null;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}

const isLoopbackHost = host => /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/.test(host);

// The URL budget a constitution may use, by carrier and where it will be served.
// browserLimit: this browser's own limit (detectUrlLimit), when one was found.
export function defaultBudget({ carrier, authority, renderBase, browserLimit = null }) {
  const browser = browserLimit ?? FIREFOX_MAX_URL;
  if (carrier === "fragment" || authority === "literal") return browser;
  return isLoopbackHost(new URL(renderBase).hostname) ? browser : Math.min(browser, HOSTED_QUERY_MAX_URL);
}

// renderBase: the URL of render.html for the loopback authority, e.g.
// "https://nth-member.github.io/gigaspeak/render.html".
export async function buildConstitution(output, {
  grammarId,
  carrier = "query",
  authority = "loopback",
  renderBase,
  maxUrlLength,
  browserLimit = null,
  random = randomBelow,
  uuid = randomUUID
} = {}) {
  const g = grammar(grammarId);
  if (carrier !== "query" && carrier !== "fragment") throw new RangeError(`Unknown carrier: ${carrier}`);
  if (authority !== "loopback" && authority !== "literal") throw new RangeError(`Unknown authority: ${authority}`);
  const base = new URL(renderBase);
  if (base.protocol !== "http:" && base.protocol !== "https:") throw new TypeError("renderBase must use HTTP or HTTPS");
  const budget = maxUrlLength ?? defaultBudget({ carrier, authority, renderBase, browserLimit });

  const identity = constituteIdentity({ random });
  const runId = uuid();
  const normalized = normalizeAscii(output);

  const origin = authority === "literal" ? `http://${identity.address}:${identity.port}` : base.origin;
  const path = authority === "literal" ? "/render.html" : base.pathname;
  const g_ = `g=${encodeURIComponent(g.id)}`;
  const who = `speaker=${encodeURIComponent(identity.address)}&port=${identity.port}&run=${encodeURIComponent(runId)}`;
  const prefix = carrier === "query" ? `${origin}${path}?${g_}&html=` : `${origin}${path}?${g_}#html=`;
  const suffix = carrier === "query" ? `#${who}` : `&${who}`;
  const encodedBudget = budget - prefix.length - suffix.length;
  if (encodedBudget < 0) throw new RangeError("URL budget is smaller than the speaker envelope");

  const selection = selectMaximumWindow(normalized.text, encodedBudget, g, { random });
  const renderUrl = `${prefix}${encodeURIComponent(g.encodeText(selection.text))}${suffix}`;
  if (renderUrl.length > budget) throw new Error("Internal error: constituted URL exceeds its budget");

  const [outputSha256, portionSha256] = await Promise.all([sha256(normalized.text), sha256(selection.text)]);
  return Object.freeze({
    runId,
    grammar: g.id,
    carrier,
    authority,
    identity,
    renderUrl,
    urlLength: renderUrl.length,
    maxUrlLength: budget,
    outputCharacters: normalized.text.length,
    outputSha256,
    nonAsciiReplacements: normalized.replacements,
    portionStart: selection.start,
    portionCharacters: selection.length,
    portionCandidates: selection.candidates,
    portionSha256
  });
}

// Reads a render URL back: the grammar, the carried document, and the speaker.
export function readRenderUrl(href) {
  const url = new URL(href);
  const query = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const inQuery = query.getAll("html");
  const inFragment = fragment.getAll("html");
  if (inQuery.length + inFragment.length !== 1) {
    throw new SyntaxError(`Expected exactly one html field; received ${inQuery.length} in the query and ${inFragment.length} in the fragment`);
  }
  return Object.freeze({
    grammarId: query.get("g") ?? fragment.get("g") ?? "span-transparent",
    carrier: inQuery.length ? "query" : "fragment",
    document: inQuery.length ? inQuery[0] : inFragment[0],
    mode: query.get("mode") ?? fragment.get("mode") ?? "validated",
    speaker: fragment.get("speaker") ?? (isLoopbackHost(url.hostname) ? null : url.hostname),
    port: fragment.get("port") ?? url.port ?? null,
    run: fragment.get("run")
  });
}
