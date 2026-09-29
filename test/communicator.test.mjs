import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localPath } from "./paths.mjs";
import test from "node:test";
import { parseAsciiTokens } from "../docs/lib/control-tokens.mjs";
import { apply, hexOf, htmFilename, prepare, replaceReference, toBytes, escapement } from "../docs/lib/communicator.mjs";

const { transforms } = JSON.parse(await readFile(new URL("../docs/data/transforms.json", import.meta.url), "utf8"));
const hex = bytes => Buffer.from(bytes).toString("hex").toUpperCase();

test("26 transforms, each a complete table", () => {
  assert.equal(transforms.length, 26);
  for (const t of transforms) {
    assert.ok(t.alphabet === 128 || t.alphabet === 256, t.id);
    assert.equal(t.values.length, t.alphabet);
    assert.match(t.sourceSha256, /^[0-9a-f]{64}$/);
  }
});

test("apply equals clojure.string/replace over the hex stream, for every transform and byte", () => {
  const bytes = Array.from({ length: 128 }, (_, b) => b).concat([0x48, 0x49, 0x0d, 0x0a, 0x7f, 0x00]);
  for (const t of transforms) assert.equal(hex(apply(prepare(t), bytes)), replaceReference(t, hexOf(bytes)), t.id);
});

test("control mnemonics follow the Communicator's rules", () => {
  const h = s => hexOf(parseAsciiTokens(s));
  assert.equal(h("NULDLEDEL"), "00107F");
  assert.equal(h("STXETX"), "0203");
  assert.equal(h("DELETE"), "44454C455445");
  assert.equal(h("\\NUL"), "4E554C");
  assert.equal(h("nul"), "6E756C");
  assert.equal(h("SP"), "5350");
  assert.equal(h("a\nb"), "610D0A62");
  assert.equal(hexOf(parseAsciiTokens("CRLF", { mode: "strict" })), "43524C46");
  assert.equal(hexOf(parseAsciiTokens("DELETE", { mode: "greedy" })), "7F455445");
  assert.throws(() => parseAsciiTokens("é"), RangeError);
  assert.throws(() => toBytes("x".repeat(2_000_001)), /limit/);
});

test("continuous uppercase hex, two digits per byte", () => {
  assert.equal(hexOf(parseAsciiTokens("HELLO. WORLD!")), "48454C4C4F2E20574F524C4421");
  assert.equal(hexOf([0x00, 0x09, 0x7f], 16), "00 09 7F");
});

test(".HTM file names", () => {
  assert.equal(htmFilename("result"), "result.HTM");
  assert.equal(htmFilename("result.html"), "result.HTM");
  assert.equal(htmFilename("result.HTM.html"), "result.HTM");
  assert.equal(htmFilename(""), "communicator.HTM");
});

test("escapement: eight sticks of sixteen", () => {
  const e = escapement();
  assert.equal(e.length, 16);
  assert.deepEqual(e[0], ["NUL", "DLE", "SP", "0", "@", "P", "`", "p"]);
  assert.equal(e[15][7], "DEL");
});

const SAMPLES = localPath("communicatorSamples");
test("output equals the Communicator's own sample .HTM files", { skip: !(SAMPLES && existsSync(SAMPLES)) && "set communicatorSamples in .paths.json" }, async () => {
  const golden = await readFile(`${SAMPLES}/hello_world__calc33_text_transparent.HTM`, "latin1");
  const labels = [...golden.matchAll(/>([^<]*)<\/TEXT>/g)].map(m => m[1]);
  const names = { SP: 0x20, CR: 0x0d, LF: 0x0a, HT: 0x09, DEL: 0x7f };
  const bytes = labels.map(l => (l.length === 1 ? l.charCodeAt(0) : names[l]));
  const t33 = transforms.find(t => t.id === "t11.2");
  assert.equal(Buffer.from(apply(prepare(t33), bytes)).toString("latin1"), golden);
  const g22 = await readFile(`${SAMPLES}/hello_world__calc22_octet.HTM`);
  assert.deepEqual(Buffer.from(apply(prepare(transforms.find(t => t.id === "t01.1")), bytes)), g22);
});
