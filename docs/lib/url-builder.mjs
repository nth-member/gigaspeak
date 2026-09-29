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

export function buildMessageUrl({ message, target, port = "", grammarId, carrier = "query", lineEnding = "CRLF", mode = "chainable" }) {
  const g = grammar(grammarId);
  const url = targetFor(target, port);
  const bytes = parseAsciiTokens(message, { lineEnding, mode });
  const html = encodeURIComponent(g.encodeBytes(bytes));
  const gParam = `g=${encodeURIComponent(g.id)}`;
  const href = carrier === "fragment"
    ? `${url.href}?${gParam}#html=${html}`
    : `${url.href}?${gParam}&html=${html}`;
  return Object.freeze({ href, bytes, length: href.length });
}
