#!/usr/bin/env node
// Rebuilds docs/data/transforms.json from the MDQNM ASCII-HEX HTM Communicator's
// generated manifest. Only the replacement tables are published: the .clj sources
// they were extracted from are identified by namespace and SHA-256, not copied.
//
//   node tools/build-transforms.mjs [path/to/communicator/generated/transforms.json]
//
// Without an argument, the path is "communicatorManifest" in the untracked .paths.json.
import { readFile, writeFile } from "node:fs/promises";
import { localPath } from "../test/paths.mjs";

const input = process.argv[2] ?? localPath("communicatorManifest");
if (!input) throw new Error("Give the manifest path, or set communicatorManifest in .paths.json");
const manifest = JSON.parse(await readFile(input, "utf8"));

const transforms = manifest.transforms.map(t => {
  if (t.status !== "usable" || t.finalization !== "hex-to-bytes" || t["max-token-length"] !== 2) {
    throw new Error(`${t.id}: unsupported transform shape`);
  }
  const size = t["expected-alphabet-size"];
  const values = Array.from({ length: size }, (_, byte) => {
    const key = byte.toString(16).toUpperCase().padStart(2, "0");
    const value = t["replacement-map"][key];
    if (typeof value !== "string" || !/^(?:[0-9A-F]{2})+$/.test(value)) throw new Error(`${t.id}: bad value for ${key}`);
    return value;
  });
  if (Object.keys(t["replacement-map"]).length !== size) throw new Error(`${t.id}: extra map keys`);
  return {
    id: t.id,
    calc: t.calc,
    namespace: t.namespace,
    file: t.filename,
    sourceSha256: t["source-sha256"],
    alphabet: size,
    values
  };
});

const out = { source: "MDQNM ASCII-HEX HTM Communicator manifest", generatedAt: manifest.generatedAt, transforms };
await writeFile(new URL("../docs/data/transforms.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`${transforms.length} transforms -> docs/data/transforms.json`);
