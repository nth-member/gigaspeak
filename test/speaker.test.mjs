import assert from "node:assert/strict";
import test from "node:test";
import { GRAMMARS, grammar } from "../docs/lib/grammar.mjs";
import { buildConstitution, constituteIdentity, defaultBudget, normalizeAscii, randomBelow, readRenderUrl, selectMaximumWindow, FIREFOX_MAX_URL, HOSTED_QUERY_MAX_URL } from "../docs/lib/speaker.mjs";

const HOSTED = "https://nth-member.github.io/gigaspeak/render.html";
const LOCAL = "http://127.0.0.1:8814/render.html";
const sequence = values => { let i = 0; return () => values[i++ % values.length]; };

test("randomBelow stays in range and reaches both ends", () => {
  const seen = new Set();
  for (let i = 0; i < 4000; i += 1) { const v = randomBelow(4); assert.ok(v >= 0 && v < 4); seen.add(v); }
  assert.equal(seen.size, 4);
  assert.throws(() => randomBelow(0), RangeError);
});

test("identity is four octets and a port", () => {
  const id = constituteIdentity({ random: sequence([10, 20, 30, 40, 8080]) });
  assert.equal(id.address, "10.20.30.40");
  assert.equal(id.port, 8080);
});

test("non-ASCII becomes ?", () => {
  assert.deepEqual({ ...normalizeAscii("a€b😀") }, { text: "a?b?", replacements: 2 });
});

test("the window is the longest that fits, and ties are sampled", () => {
  const g = grammar("span-transparent");
  const w = g.encodedTokenLength(0x61);
  const r = selectMaximumWindow("aaaaa", 3 * w, g, { random: () => 1 });
  assert.equal(r.length, 3);
  assert.equal(r.candidates, 3);
  assert.equal(r.start, 0);
  assert.equal(selectMaximumWindow("aaaaa", 3 * w, g, { random: () => 0 }).start, 2);
  assert.equal(selectMaximumWindow("", 10, g).length, 0);
});

test("budgets: fragment and loopback get Firefox's limit, a hosted query gets 8,000", () => {
  assert.equal(defaultBudget({ carrier: "fragment", authority: "loopback", renderBase: HOSTED }), FIREFOX_MAX_URL);
  assert.equal(defaultBudget({ carrier: "query", authority: "loopback", renderBase: HOSTED }), HOSTED_QUERY_MAX_URL);
  assert.equal(defaultBudget({ carrier: "query", authority: "loopback", renderBase: LOCAL }), FIREFOX_MAX_URL);
  assert.equal(defaultBudget({ carrier: "query", authority: "literal", renderBase: HOSTED }), FIREFOX_MAX_URL);
});

const text = "The quick brown fox\r\njumps over the lazy dog. ".repeat(4000);
for (const g of GRAMMARS) {
  for (const carrier of ["query", "fragment"]) {
    for (const authority of ["loopback", "literal"]) {
      test(`edition ${g.id} / ${carrier} / ${authority}: URL fits and reads back`, async () => {
        const c = await buildConstitution(text, { grammarId: g.id, carrier, authority, renderBase: HOSTED });
        assert.ok(c.urlLength <= c.maxUrlLength);
        assert.ok(c.portionCharacters > 0);
        const r = readRenderUrl(c.renderUrl);
        assert.equal(r.grammarId, g.id);
        assert.equal(r.carrier, carrier);
        assert.equal(r.run, c.runId);
        assert.equal(grammar(g.id).decode(r.document).text, text.slice(c.portionStart, c.portionStart + c.portionCharacters));
        const host = new URL(c.renderUrl).host;
        assert.equal(host, authority === "literal" ? `${c.identity.address}:${c.identity.port}` : "nth-member.github.io");
        assert.match(c.outputSha256, /^[0-9a-f]{64}$/);
      });
    }
  }
}

test("a hosted query URL stays under GitHub Pages' limit; a fragment URL uses the full budget", async () => {
  const big = "x".repeat(200_000);
  const q = await buildConstitution(big, { grammarId: "span-transparent", carrier: "query", renderBase: HOSTED });
  assert.ok(q.urlLength <= 8000 && q.urlLength > 7000);
  const f = await buildConstitution(big, { grammarId: "span-zero", carrier: "fragment", renderBase: HOSTED });
  assert.ok(f.urlLength <= FIREFOX_MAX_URL && f.urlLength > FIREFOX_MAX_URL - 200);
});

test("readRenderUrl refuses zero or two documents", () => {
  assert.throws(() => readRenderUrl(`${HOSTED}?g=span-zero`), /exactly one/);
  assert.throws(() => readRenderUrl(`${HOSTED}?html=#html=`), /exactly one/);
});
