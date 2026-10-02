// A message (ASCII with control mnemonics) to a render URL in any grammar and
// carrier. The target is a renderer address: this app's render.html by default,
// or any origin and port, as in the original URL strategy.

import { parseAsciiTokens } from "./control-tokens.mjs";
import { grammar } from "./grammar.mjs";

const loopback = host => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

// "example.org", "127.0.0.1", "https://host/path/render.html" -> a URL without query or fragment.
export function targetFor(target, port = "") {
  if (typeof target !== "string" || target.trim() === "") throw new TypeError("A target address is required");
  const value = target.trim();
  const withScheme = /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(value);
  const probe = new URL(withScheme ? value : `http://${value}`);
  if (probe.protocol !== "http:" && probe.protocol !== "https:") throw new RangeError("The target must use http or https");
  if (probe.username || probe.password) throw new RangeError("The target must not contain user information");
  if (probe.search || probe.hash) throw new RangeError("The target must not contain a query or fragment");
  const url = new URL(probe.href);
  if (!withScheme) url.protocol = loopback(probe.hostname) ? "http:" : "https:";
  const text = String(port ?? "").trim();
  if (text !== "") {
    if (probe.port) throw new RangeError("Give the port in one place only");
    if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 65535) throw new RangeError("Port must be an integer from 1 through 65535");
    url.port = text;
  }
  return url;
}

// Each byte's token, percent-encoded once per grammar. Tokens begin and end on
// ASCII characters, so joining encoded tokens equals encoding the joined document.
const ENCODED = new Map();
function encodedTokens(g) {
  if (!ENCODED.has(g.id)) ENCODED.set(g.id, Array.from({ length: 128 }, (_, b) => encodeURIComponent(g.tokenForByte(b))));
  return ENCODED.get(g.id);
}

// message: ASCII text with control mnemonics, parsed with lineEnding and mode.
// bytes:   alternatively, the exact bytes (00-7F) to carry, e.g. a file's contents.
// The address is never shortened, whatever its length.
export function buildMessageUrl({ message, bytes: given, target, port = "", grammarId, carrier = "query", lineEnding = "CRLF", mode = "chainable" }) {
  const g = grammar(grammarId);
  const url = targetFor(target, port);
  const bytes = given ?? parseAsciiTokens(message, { lineEnding, mode });
  const enc = encodedTokens(g);
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (!Number.isInteger(b) || b < 0 || b > 0x7f) throw new RangeError(`Byte ${i + 1} is ${b}; only ASCII 00-7F can be carried`);
    parts[i] = enc[b];
  }
  const html = parts.join("");
  const gParam = `g=${encodeURIComponent(g.id)}`;
  const href = carrier === "fragment"
    ? `${url.href}?${gParam}#html=${html}`
    : `${url.href}?${gParam}&html=${html}`;
  return Object.freeze({ href, bytes, length: href.length, hostname: url.hostname });
}
