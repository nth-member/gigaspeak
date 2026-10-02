import assert from "node:assert/strict";
import test from "node:test";
import { GRAMMARS, grammar } from "../docs/lib/grammar.mjs";
import { readRenderUrl } from "../docs/lib/speaker.mjs";
import { buildMessageUrl, targetFor } from "../docs/lib/url-builder.mjs";
import { generate } from "../docs/lib/teletype.mjs";

const HOSTED = "https://nth-member.github.io/gigaspeak/render.html";

test("a message with control mnemonics builds a URL that reads back", () => {
  const r = buildMessageUrl({ message: "STX Hi ETX", target: HOSTED, grammarId: "span-transparent" });
  assert.deepEqual([...r.bytes], [0x02, 0x20, 0x48, 0x69, 0x20, 0x03]);
  assert.deepEqual([...grammar("span-transparent").decode(readRenderUrl(r.href).document).bytes], [...r.bytes]);
});

test("bytes are carried exactly, with no length limit, in every grammar and carrier", () => {
  const { bytes } = generate("asr37", { seed: 11, size: 120_000 });   // CR, bare CR, NUL, ESC, SYN, DLE …
  for (const g of GRAMMARS) {
    for (const carrier of ["query", "fragment"]) {
      const r = buildMessageUrl({ bytes, message: "ignored", target: HOSTED, grammarId: g.id, carrier });
      assert.ok(r.length > 8000 * 100, "far beyond GitHub's query limit, and not shortened");
      const back = readRenderUrl(r.href);
      assert.equal(back.carrier, carrier);
      assert.deepEqual(Buffer.from(grammar(g.id).decode(back.document).bytes), Buffer.from(bytes), `${g.id}/${carrier}`);
    }
  }
});

test("joined encoded tokens equal encoding the whole document", () => {
  const bytes = Array.from({ length: 128 }, (_, b) => b);
  for (const g of GRAMMARS) {
    const r = buildMessageUrl({ bytes, target: HOSTED, grammarId: g.id });
    assert.ok(r.href.endsWith(`&html=${encodeURIComponent(grammar(g.id).encodeBytes(bytes))}`), g.id);
  }
});

test("bytes outside ASCII and bad targets are refused", () => {
  assert.throws(() => buildMessageUrl({ bytes: [0x41, 0x80], target: HOSTED, grammarId: "span-zero" }), /only ASCII/);
  assert.throws(() => targetFor("ftp://x"), RangeError);
  assert.throws(() => targetFor("https://x/?q=1"), RangeError);
});
