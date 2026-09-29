// The MDQNM ASCII-HEX HTM Communicator, in the browser.
//
// Pipeline, as in the original: ASCII text -> continuous uppercase hex ->
// clojure.string/replace with one MDQNM replacement map -> hex-to-bytes -> .HTM.
// Every map is keyed by the two-digit hex of one byte, and the regex matches
// exactly those keys, so s/replace over the continuous hex stream is the same
// as replacing each byte's pair by its value. The tables come from
// data/transforms.json (see tools/build-transforms.mjs).

import { parseAsciiTokens } from "./control-tokens.mjs";
import { CONTROL_NAMES, hex2 } from "./grammar.mjs";

export const MAX_INPUT = 2_000_000;

export function toBytes(text, options) {
  const bytes = parseAsciiTokens(text, options);
  if (bytes.length > MAX_INPUT) throw new RangeError(`Input is ${bytes.length.toLocaleString("en-US")} bytes; the limit is 2,000,000`);
  return bytes;
}

export function hexOf(bytes, perLine = 0) {
  const pairs = Array.from(bytes, hex2);
  if (!perLine) return pairs.join("");
  const lines = [];
  for (let i = 0; i < pairs.length; i += perLine) lines.push(pairs.slice(i, i + perLine).join(" "));
  return lines.join("\n");
}

function valueBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

// Prepares a transform for repeated use: each byte's replacement, already decoded.
export function prepare(transform) {
  const table = transform.values.map(valueBytes);
  const lengths = table.map(v => v.length);
  return Object.freeze({ ...transform, table, lengths });
}

// Applies a prepared transform. Returns the output as one Uint8Array.
export function apply(prepared, bytes) {
  let total = 0;
  for (const byte of bytes) {
    if (byte >= prepared.alphabet) throw new RangeError(`Byte 0x${hex2(byte)} is outside ${prepared.id}'s ${prepared.alphabet}-entry alphabet`);
    total += prepared.lengths[byte];
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const byte of bytes) {
    out.set(prepared.table[byte], offset);
    offset += prepared.lengths[byte];
  }
  return out;
}

// The reference semantics, for tests: clojure.string/replace over the hex stream.
export function replaceReference(transform, hexStream) {
  const map = Object.fromEntries(transform.values.map((v, byte) => [hex2(byte), v]));
  const regex = new RegExp(Object.keys(map).join("|"), "g");
  return hexStream.replace(regex, token => map[token]);
}

// "result", "result.html", "result.HTM.html" -> "result.HTM"
export function htmFilename(name) {
  const stem = String(name ?? "").trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/(\.html?)+$/i, "").replace(/(\.htm)+$/i, "");
  return `${stem || "communicator"}.HTM`;
}

// The eight vertical sticks of the ASCII escapement: 16 rows, byte = column*16 + row.
export function escapement(label = b => (b < 0x20 ? CONTROL_NAMES[b] : b === 0x20 ? "SP" : b === 0x7f ? "DEL" : String.fromCharCode(b))) {
  return Array.from({ length: 16 }, (_, row) => Array.from({ length: 8 }, (_, col) => label(col * 16 + row)));
}

// Friendly name for a transform, from its namespace.
export function transformTitle(t) {
  const leaf = t.namespace.split(".").pop().replace(/-/g, " ");
  return `${t.calc} · ${leaf}${/\.2$/.test(t.id) ? " (second map)" : ""}`;
}
