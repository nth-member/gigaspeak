import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localPath } from "./paths.mjs";
import test from "node:test";
import { GRAMMARS, grammar } from "../docs/lib/grammar.mjs";

const transforms = JSON.parse(await readFile(new URL("../docs/data/transforms.json", import.meta.url), "utf8")).transforms;
const table = id => transforms.find(t => t.id === id).values.map(v => Buffer.from(v, "hex").toString("latin1"));
const ALL = Array.from({ length: 128 }, (_, b) => b);
const opening = token => token.slice(0, token.indexOf(">") + 1);

test("six grammars, one per colour depth and tag form", () => {
  assert.equal(GRAMMARS.length, 6);
  assert.equal(new Set(GRAMMARS.map(g => `${g.colors}/${g.form}`)).size, 6);
});

test("known colours are reproduced", () => {
  const g = grammar("span-transparent");
  assert.deepEqual({ ...g.colorsForByte(0x00) }, { foreground: "#00000000", background: "#00000000" });
  assert.deepEqual({ ...g.colorsForByte(0x23) }, { foreground: "#00AA0023", background: "#00AAAA23" });
  assert.deepEqual({ ...g.colorsForByte(0x7f) }, { foreground: "#AAAAAA7F", background: "#FFFFFF7F" });
  assert.deepEqual({ ...grammar("calc28-span").colorsForByte(0x41) }, { foreground: "#AA0000", background: "#0000AA" });
});

for (const spec of GRAMMARS) {
  test(`${spec.id}: all 128 bytes round-trip and colour pairs are unique`, () => {
    const g = grammar(spec.id);
    assert.deepEqual([...g.decode(g.encodeBytes(ALL)).bytes], ALL);
    assert.equal(new Set(ALL.map(b => JSON.stringify(g.colorsForByte(b)))).size, 128);
    assert.equal(g.decode("").bytes.length, 0);
  });

  test(`${spec.id}: non-canonical input is rejected`, () => {
    const g = grammar(spec.id);
    const a = g.tokenForByte(0x41);
    assert.throws(() => g.decode("<SCRIPT>alert(1)</SCRIPT>"), SyntaxError);
    assert.throws(() => g.decode(a.replace("AA0000", "BB0000")), SyntaxError);
    assert.throws(() => g.decode(a.toLowerCase()), SyntaxError);
    assert.throws(() => g.decode(a + "x"), SyntaxError);
    if (spec.form === "closed") assert.throws(() => g.decode(a.replace(">A<", ">B<")), /does not match/);
    if (spec.colors === "rgba") assert.throws(() => g.decode(a.replace("0000AA41", "0000AA42")), SyntaxError);
  });
}

test("closed and opening-tag grammars equal the MDQNM tables byte for byte", () => {
  const rgbaClosed = table("t09.1"), rgbaOpen = table("t10.1"), rgbClosed = table("t07.1");
  for (const b of ALL) {
    assert.equal(grammar("span-transparent").tokenForByte(b), rgbaClosed[b]);
    assert.equal(grammar("span-transparent-zero-opening-tags").tokenForByte(b), rgbaOpen[b]);
    assert.equal(grammar("span-transparent-zero").tokenForByte(b), `${rgbaOpen[b]}</SPAN>`);
    assert.equal(grammar("calc28-span").tokenForByte(b), rgbClosed[b]);
    assert.equal(grammar("span-zero").tokenForByte(b), opening(rgbClosed[b]));
    assert.equal(grammar("span-zero-closing-tags").tokenForByte(b), `${opening(rgbClosed[b])}</SPAN>`);
  }
});

// The 24 original editions, when their folder is present, must agree token for token.
const EDITIONS = localPath("editions");
const ORIGINAL = {
  "span-transparent": "random-gigamonkey-speaker/src/ascii-html-color-span-transparent.mjs",
  "span-transparent-zero-opening-tags": "random-gigamonkey-speaker-transparent-zero/src/ascii-html-color-zero.mjs",
  "span-transparent-zero": "random-gigamonkey-speaker-span-transparent-zero/src/ascii-html-color-span-transparent-zero.mjs",
  "calc28-span": "random-gigamonkey-speaker-calc28-span/src/ascii-html-color-calc28-span.mjs",
  "span-zero": "random-gigamonkey-speaker-span-zero/src/ascii-html-color-span-zero.mjs",
  "span-zero-closing-tags": "random-gigamonkey-speaker-span-zero-closing-tags/src/ascii-html-color-span-zero-closing-tags.mjs"
};
test("tokens equal the original editions' codecs", { skip: !(EDITIONS && existsSync(EDITIONS)) && "set editions in .paths.json" }, async () => {
  for (const [id, path] of Object.entries(ORIGINAL)) {
    for (const variant of ["", "-fragment-id", "-literal-authority", "-literal-authority-fragment-id"]) {
      const file = `${EDITIONS}/${path.replace("/", `${variant}/`)}`;
      const original = await import(file);
      for (const b of ALL) assert.equal(grammar(id).tokenForByte(b), original.tokenForByte(b), `${id}${variant} 0x${b.toString(16)}`);
    }
  }
});
