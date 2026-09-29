// Paths to the original developments on the author's computer, for the tests
// that compare against them and for tools/build-transforms.mjs. They live in the
// untracked .paths.json (see .paths.example.json); without it those tests skip.
import { readFileSync } from "node:fs";

let paths = {};
try { paths = JSON.parse(readFileSync(new URL("../.paths.json", import.meta.url), "utf8")); } catch { /* not configured */ }

export const localPath = key => paths[key] ?? null;
