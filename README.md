# Gigaspeak

**ASCII carried in colour.** Each byte becomes one SPAN whose colours encode its seven bits.
Served at https://nth-member.github.io/gigaspeak/. Everything runs in the page; `docs/` is the site.

**[How to use Gigaspeak](how-to-use.md)**: each tab step by step, the grammars, URL length and the
query string's limits, local use, and what to do when something goes wrong.

Gigaspeak brings three earlier developments into one static application:

| tab | what it does | formerly |
|---|---|---|
| **Speak** | runs the MDQNM namespace `mdqnm-timemachines-and-clocks`, draws a random four-octet speaker and port, chooses at random one of the longest parts of the output that fits a URL, encodes it in the chosen grammar and opens the transmission | the 24 Random Gigamonkey Speaker editions and their Gigaspeak launcher (Node servers on ports 8790–8814) |
| **Build URL** | encodes a message written in ASCII, with control mnemonics (`NUL`, `CR`, `ESC`, `DEL`, …), as a render URL; decodes such URLs | the ASCII-HTML colour URL strategy |
| **Communicator** | ASCII text → continuous uppercase hex → one of 26 MDQNM `s/replace` transforms → bytes → a `.HTM` file | the MDQNM ASCII-HEX HTM Communicator (Clojure server on port 7797) and the single-file ASCII Communicator |
| **Grammars** | the six grammars and all 128 byte colours | — |

## The grammars

Foreground R, G, B carry bits 6, 5, 4 (`00`/`AA`). The background carries bit 3 as its base (`00`/`55`)
and bits 2, 1, 0 as `+AA` on R, G, B. Both colour depths are therefore lossless; the RGBA grammars
also repeat the byte as the alpha pair of both colours. A grammar is one colour depth and one tag form:

| | closed, with label | opening tag only | closed, empty |
|---|---|---|---|
| **RGBA** (calc32) | SPAN Transparent | SPAN Transparent Zero · Opening Tags | SPAN Transparent Zero · Closing Tags |
| **RGB** (calc28) | Calc28 Full SPAN | Span Zero | Span Zero · Closing Tags |

`docs/lib/grammar.mjs` is the single codec for all six. Its decoder is the strict inverse of the
encoder: any spelling other than the canonical token sequence is rejected with the offset of the first
bad token.

## The 24 editions

The original editions were 6 grammars × 2 carriers × 2 authorities, each a separate server. They are
now three choices on the Speak tab:

- **Carrier.** *Query* (`render.html?g=…&html=…`) is sent to the server with the request; GitHub Pages
  refuses request targets longer than about 8,190 characters, so a hosted query URL is limited to 8,000.
  *Fragment* (`render.html?g=…#html=…`) never leaves the browser and may use the longest address the
  browser accepts. Firefox accepts at most `network.standard-url.max-length` less 4 characters:
  1,048,572 by default. The page measures the viewer's own limit on loading, so a raised setting is
  used (4,194,300 characters, 45,001 bytes of text, was verified).
- **Authority.** *Loopback*: the page's own address renders, and the random `A.B.C.D:PORT` is carried as
  identity. *Literal*: `http://A.B.C.D:PORT/render.html…` is itself the address; a Firefox profile
  proxied to the local server (below) routes the unassigned address back to it.

The receiver (`render.html`) validates the document against its grammar before any of it reaches
`innerHTML`. `mode=raw` shows the unvalidated `html` field, as the URL strategy's `req.query.html`
sink did, inside a sandboxed frame with no scripts and an opaque origin.

## The engine

The Speak tab runs the MDQNM engine in the page with the Alien Corridor Support System's SCI port:
`docs/vendor/scittle-0.8.33.js` and `docs/vendor/acss-engine.js` are copied from
[nth-member/alien-corridor](https://github.com/nth-member/alien-corridor), and the engine's `.clj`
sources are read from that site, which publishes them byte for byte. `mdqnm-timemachines-and-clocks`
requires the whole primary tree (90 namespaces); a run takes about ten seconds and prints about
3.77 million characters. The declared differences from the JVM are those listed on the Alien Corridor
site's fidelity page. A **Text I supply** source needs no engine.

## The Communicator's transforms

`docs/data/transforms.json` holds the 26 replacement tables (24 source files; two files carry two maps
each), with each source file's namespace and SHA-256. The `.clj` source files themselves are not
copied. `tools/build-transforms.mjs` rebuilds the file from the Communicator's generated manifest.
Every table is keyed by the two-digit hex of one byte, and its regex matches exactly those keys, so
`clojure.string/replace` over the continuous hex stream equals replacing each byte by its value; the
tests check this for every table and byte.

## Local use

```bash
cd docs && python3 -m http.server 8000     # the static site, as GitHub Pages serves it
node server.mjs                            # http://127.0.0.1:8814/ with the two local additions
npm test                                   # 58 tests; Node 20 or later
node bin/gigaspeak.mjs                     # command line: encode, url, decode, inspect, htm
```

`server.mjs` serves `docs/` and adds what a static host cannot provide: the literal authority (it opens
a temporary Firefox profile proxied to itself) and, when an Alien Corridor Support System is running at
`GIGASPEAK_ENGINE_ORIGIN` (default `http://127.0.0.1:7777`), the JVM engine as a Speak source. The page
enables both options only when it finds the server.

## Verification

`npm test` checks:

- all six grammars round-trip all 128 bytes, have 128 distinct colour pairs, and reject altered tokens;
- the closed and opening-tag tokens equal the MDQNM calc28 and calc32 tables byte for byte, and the
  derived forms follow from them;
- when the original editions are on the computer, every token equals the original codecs' in all 24;
- every edition's URL fits its budget and reads back to the chosen portion, and the browser-limit
  detection finds Firefox's limit (its setting less 4) and ignores parsers without one;
- every Communicator transform equals `clojure.string/replace`, and, when present, the Communicator's
  own sample `.HTM` files are reproduced byte for byte;
- the control-mnemonic rules (chainable, strict, greedy, `\` escape, line endings);
- the local server's static serving, proxied literal addresses and path containment.

## The nth-member sites

| site | repository | what it is |
|---|---|---|
| https://nth-member.github.io/revott/ | nth-member/revott | REVOTT atop GDELT: the field at every node of an instance |
| https://nth-member.github.io/gdelt/ | nth-member/gdelt | what GDELT was reading on a given day |
| https://nth-member.github.io/member/ | nth-member/member | the nth member: REVOTT's numerator, its introspection and its journal |
| https://nth-member.github.io/gematria/ | nth-member/gematria | H-Gematria/ASCII: the two name-value programs in the browser |
| https://nth-member.github.io/alien-corridor/ | nth-member/alien-corridor | the Alien Corridor Support System (MDQNM engine) in the browser |
| https://nth-member.github.io/gigaspeak/ | nth-member/gigaspeak | Gigaspeak: ASCII carried in colour, the speaker, the URL builder and the Communicator |

## Licence

scittle and the Alien Corridor engine adapter in `docs/vendor/` are under the Eclipse Public License
1.0 (`docs/vendor/LICENSE-EPL-1.0`).
