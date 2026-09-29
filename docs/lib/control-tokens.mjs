// ASCII text with official uppercase control mnemonics (NUL, CR, ESC, DEL, …)
// to bytes. One parser for the URL builder and the Communicator; the modes and
// the backslash escape are those of the ASCII Communicator.

export const CONTROL_TOKENS = Object.freeze({
  NUL: 0x00, SOH: 0x01, STX: 0x02, ETX: 0x03, EOT: 0x04, ENQ: 0x05, ACK: 0x06, BEL: 0x07,
  BS: 0x08, HT: 0x09, LF: 0x0a, VT: 0x0b, FF: 0x0c, CR: 0x0d, SO: 0x0e, SI: 0x0f,
  DLE: 0x10, DC1: 0x11, DC2: 0x12, DC3: 0x13, DC4: 0x14, NAK: 0x15, SYN: 0x16, ETB: 0x17,
  CAN: 0x18, EM: 0x19, SUB: 0x1a, ESC: 0x1b, FS: 0x1c, GS: 0x1d, RS: 0x1e, US: 0x1f,
  DEL: 0x7f
});

const LENGTH_2 = Object.freeze(Object.fromEntries(Object.entries(CONTROL_TOKENS).filter(([name]) => name.length === 2)));
const LENGTH_3 = Object.freeze(Object.fromEntries(Object.entries(CONTROL_TOKENS).filter(([name]) => name.length === 3)));

function isWordCode(code) {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

function matchToken(text, position) {
  const token3 = text.slice(position, position + 3);
  if (Object.hasOwn(LENGTH_3, token3)) return { length: 3, value: LENGTH_3[token3] };
  const token2 = text.slice(position, position + 2);
  if (Object.hasOwn(LENGTH_2, token2)) return { length: 2, value: LENGTH_2[token2] };
  return null;
}

export function parseAsciiTokens(text, { lineEnding = "CRLF", mode = "chainable" } = {}) {
  if (typeof text !== "string") throw new TypeError("Message must be a string");
  if (!new Set(["chainable", "strict", "greedy"]).has(mode)) throw new RangeError("Unknown token mode");
  if (!new Set(["CRLF", "LF", "CR"]).has(lineEnding)) throw new RangeError("Unknown line ending");

  const strict = mode === "strict";
  const greedy = mode === "greedy";
  const newline = lineEnding === "CRLF" ? [13, 10] : lineEnding === "CR" ? [13] : [10];
  const bytes = [];
  let position = 0;
  let previousToken = false;

  while (position < text.length) {
    const code = text.charCodeAt(position);
    if (code > 127) throw new RangeError("Non-ASCII character at UTF-16 index " + position);

    if (code === 10) {
      bytes.push(...newline);
      position += 1;
      previousToken = false;
    } else if (code === 13) {
      position += text.charCodeAt(position + 1) === 10 ? 2 : 1;
      bytes.push(...newline);
      previousToken = false;
    } else if (code === 92) {
      const escaped = matchToken(text, position + 1);
      const after = escaped ? position + 1 + escaped.length : position + 1;
      const executable = escaped && (greedy || after >= text.length || !isWordCode(text.charCodeAt(after)) || (!strict && matchToken(text, after)));
      if (executable) {
        for (let index = 0; index < escaped.length; index += 1) bytes.push(text.charCodeAt(position + 1 + index));
        position += escaped.length + 1;
      } else {
        bytes.push(92);
        position += 1;
      }
      previousToken = false;
    } else if (code >= 65 && code <= 90) {
      const token = matchToken(text, position);
      const left = greedy || position === 0 || !isWordCode(text.charCodeAt(position - 1)) || (!strict && previousToken);
      const after = token ? position + token.length : position;
      const right = token && (greedy || after >= text.length || !isWordCode(text.charCodeAt(after)) || (!strict && matchToken(text, after)));
      if (token && left && right) {
        bytes.push(token.value);
        position += token.length;
        previousToken = true;
      } else {
        bytes.push(code);
        position += 1;
        previousToken = false;
      }
    } else {
      bytes.push(code);
      position += 1;
      previousToken = false;
    }
  }

  return bytes;
}
