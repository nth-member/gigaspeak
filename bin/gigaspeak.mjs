#!/usr/bin/env node
// Command-line access to the Gigaspeak codecs and the Communicator.
import { readFile, writeFile } from "node:fs/promises";
import { GRAMMARS, grammar, labelForByte } from "../docs/lib/grammar.mjs";
import { parseAsciiTokens } from "../docs/lib/control-tokens.mjs";
import { readRenderUrl } from "../docs/lib/speaker.mjs";
import { apply, hexOf, htmFilename, prepare } from "../docs/lib/communicator.mjs";

const usage = `Usage:
  gigaspeak.mjs encode [-g GRAMMAR] TEXT         TEXT (with control mnemonics) -> SPAN document
  gigaspeak.mjs url [-g GRAMMAR] [-f] BASE TEXT   render URL for BASE (-f: fragment carrier)
  gigaspeak.mjs decode URL                        grammar, bytes and text of a render URL
  gigaspeak.mjs inspect BYTE_HEX                  one byte in all six grammars
  gigaspeak.mjs grammars                          list the grammars
  gigaspeak.mjs transforms                        list the Communicator transforms
  gigaspeak.mjs htm TRANSFORM_ID INPUT.txt [OUT]  Communicator: ASCII file -> .HTM

GRAMMAR defaults to span-transparent.`;

function options(args) {
  const out = { grammarId: "span-transparent", fragment: false, rest: [] };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "-g") out.grammarId = args[++i];
    else if (args[i] === "-f") out.fragment = true;
    else out.rest.push(args[i]);
  }
  return out;
}

async function transforms() {
  return JSON.parse(await readFile(new URL("../docs/data/transforms.json", import.meta.url), "utf8")).transforms;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "encode") {
    const o = options(args);
    console.log(grammar(o.grammarId).encodeBytes(parseAsciiTokens(o.rest.join(" "))));
  } else if (command === "url") {
    const o = options(args);
    const [base, ...text] = o.rest;
    const doc = encodeURIComponent(grammar(o.grammarId).encodeBytes(parseAsciiTokens(text.join(" "))));
    console.log(`${new URL(base).href}?g=${o.grammarId}${o.fragment ? "#" : "&"}html=${doc}`);
  } else if (command === "decode") {
    const r = readRenderUrl(args[0]);
    const d = grammar(r.grammarId).decode(r.document);
    console.log(JSON.stringify({ grammar: r.grammarId, carrier: r.carrier, hex: hexOf(d.bytes), text: d.text }, null, 2));
  } else if (command === "inspect") {
    if (!/^[0-7][0-9A-F]$/i.test(args[0] ?? "")) throw new SyntaxError("inspect expects one byte from 00 through 7F");
    const b = Number.parseInt(args[0], 16);
    console.log(JSON.stringify({ byte: b, label: labelForByte(b), tokens: Object.fromEntries(GRAMMARS.map(g => [g.id, grammar(g.id).tokenForByte(b)])) }, null, 2));
  } else if (command === "grammars") {
    for (const g of GRAMMARS) console.log(`${g.id.padEnd(36)} ${g.colors.padEnd(5)} ${g.form.padEnd(7)} ${g.title}`);
  } else if (command === "transforms") {
    for (const t of await transforms()) console.log(`${t.id.padEnd(6)} ${String(t.alphabet).padEnd(4)} ${t.namespace}`);
  } else if (command === "htm") {
    const [id, input, out] = args;
    const t = (await transforms()).find(x => x.id === id);
    if (!t) throw new RangeError(`Unknown transform ${id}; see "transforms"`);
    const bytes = parseAsciiTokens(await readFile(input, "latin1"));
    const name = htmFilename(out ?? input.replace(/\.[^.]*$/, ""));
    await writeFile(name, apply(prepare(t), bytes));
    console.log(name);
  } else {
    console.log(usage);
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
