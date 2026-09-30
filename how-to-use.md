# How to use Gigaspeak

Gigaspeak is at **https://nth-member.github.io/gigaspeak/**. It runs entirely in the browser: nothing
is installed, and no text you enter is sent anywhere. The page has four tabs. Each tab can be opened
directly by its address:

| tab | address |
|---|---|
| Speak | https://nth-member.github.io/gigaspeak/#speak |
| Build URL | https://nth-member.github.io/gigaspeak/#build |
| Communicator | https://nth-member.github.io/gigaspeak/#communicate |
| Grammars | https://nth-member.github.io/gigaspeak/#about |

The page remembers the last tab and the menu choices in the browser, so they are as you left them on
the next visit.

---

## 1. Speak: one press, one transmission

The Speak tab runs the MDQNM namespace `mdqnm-timemachines-and-clocks`, takes part of its output, and
opens it as a coloured transmission in a new tab.

### Steps

1. Choose the four settings (section 1.1). The defaults work.
2. Press **CONSTITUTE AND SPEAK**.
3. Wait. The status line reports each stage: loading the engine, reading its sources, evaluating the
   namespace, constituting the speaker. A run takes about ten seconds; the first run in a session
   takes longest, because the engine's sources are downloaded then.
4. The transmission opens in a new tab. If the browser blocks the new tab, the status line says so;
   use **Open the transmission ↗** instead.
5. **Copy URL** copies the transmission's address, which can be sent to anyone. The address itself
   carries the whole transmission, so it opens identically anywhere.

### 1.1 The settings

| setting | choices | effect |
|---|---|---|
| **Grammar** | six (section 5) | how each byte is written as a coloured SPAN |
| **Carrier** | **Fragment ID (#html=)**, **Query string (?html=)** | where the transmission sits in the address (section 1.3) |
| **Authority** | **This page renders** | the random address `A.B.C.D:PORT` is shown as the speaker's identity |
| | **Literal A.B.C.D:PORT** | the random address is the web address itself; needs the local server (section 6) |
| **Source** | **MDQNM engine, in this page** | runs the namespace in the browser |
| | **MDQNM engine, JVM** | runs it on a local Alien Corridor Support System; needs the local server |
| | **Text I supply** | a box appears; whatever is typed there is transmitted instead |

Options that need the local server are shown greyed out when it is not running.

### 1.2 What the result cards mean

| card | meaning |
|---|---|
| **Speaker** | the random four-octet address and port drawn for this run |
| **Source** | the length of the source text, how many non-ASCII characters were replaced by `?`, and its SHA-256 |
| **Portion** | the part transmitted: its length, where it starts in the source, and how many equally long parts it was chosen from at random |
| **URL** | the length of the transmission's address against its limit, and the grammar |
| **Engine** | what produced the source text, and how long the engine took |
| **Run** | a unique identifier for this run, also carried in the address |

### 1.3 Choosing a carrier

- **Fragment ID** (the default) can carry an address as long as the browser accepts: 1,048,572
  characters in Firefox by default, which is about 11,000 bytes of text. The transmission never leaves
  the browser: web servers do not receive the part of an address after `#`. Use it for long
  transmissions.
- **Query string** is sent to the server with the request. GitHub Pages refuses addresses longer than
  about 8,190 characters, so on the published site a query transmission is limited to 8,000 characters
  of address, which is 85 to 105 bytes of text, depending on the grammar.

The limit is chosen automatically, from the carrier and from the limit the page measures in your
browser. To set another, open **URL budget** and enter a maximum address length; leave it empty for the
automatic value. A budget above what the browser accepts is refused with a message rather than
producing an address that cannot be opened. Section 7 sets out the limits in full, and section 7.2 how
to raise Firefox's.

---

## 2. The transmission page

The transmission opens on `render.html`. Its header shows:

- **Gigaspeak · A.B.C.D:PORT**: the speaker's identity (the Gigaspeak link returns to the main page);
- the grammar, the number of tokens, and the carrier.

Before anything is displayed, every token is checked against the grammar named in the address. Any
alteration (a changed colour, a wrong label, an added tag) is refused, and the page shows
**Transmission rejected** with the position of the first bad token.

Controls in the header:

- **show byte labels** (only for the grammars without visible text) writes each byte's character in
  its SPAN, so the invisible transmission can be read;
- **Copy decoded text** copies the transmitted text itself.

In the grammars with an alpha channel, a byte's value is also its opacity: bytes with low values
(control characters, space, punctuation) are drawn faintly or not at all. This is part of the grammar,
not a fault in the display.

---

## 3. Build URL: a transmission from your own message

1. Type the message in **Message**. It must be ASCII (no accented letters, curly quotes or other
   symbols outside ASCII; the status line names any that are found).
2. Choose **Grammar** and **Carrier**.
3. The address appears in **URL** as you type, with its length and a coloured **preview**.
4. **Open ↗** opens it; **Copy URL** copies it.

### 3.1 Control characters

The 33 ASCII control characters can be written by their official uppercase names:

```
NUL SOH STX ETX EOT ENQ ACK BEL  BS HT LF VT FF CR SO SI
DLE DC1 DC2 DC3 DC4 NAK SYN ETB  CAN EM SUB ESC FS GS RS US   DEL
```

- Only exact uppercase is recognised: `NUL` is byte 00, but `nul` and `Nul` are letters.
- A backslash keeps the letters: `\NUL` is the three letters N, U, L.
- `SP` is not a name for space; type a space.
- **Tokens** sets how names are separated from surrounding text:
  - **Chainable** (default): names may touch each other and punctuation (`STXETX` is 02 03), but a
    name inside a word stays text (`DELETE` is six letters).
  - **Strict**: a name needs a space, punctuation or line boundary on both sides.
  - **Greedy**: every occurrence is converted, even inside words. Use only for pure control-code
    streams.
- **Line breaks** sets what pressing Enter produces: CRLF (0D 0A, default), LF (0A) or CR (0D). The
  names `CR` and `LF` always produce their own bytes.

### 3.2 Renderer and port

**Renderer** is the address of the page that will display the transmission. It is this site's
`render.html` by default. Another address may be entered, for example a local server; **Port** adds a
port number to it. The address must not contain a query (`?`) or fragment (`#`).

If a query-string address for the published site grows beyond 8,000 characters, the status line turns
red; switch the carrier to Fragment (section 7).

### 3.3 Decoding an address

Open **Decode a URL** and paste any Gigaspeak transmission address. It shows the grammar, the carrier,
the number of bytes, their hexadecimal values and the text. Addresses that fail the grammar check are
reported with the reason.

---

## 4. Communicator: text to a .HTM file

The Communicator converts text through one of the 26 MDQNM transforms and saves the result as a file
ending in `.HTM`.

1. Give the Communicator its input in one of three ways:
   - type or paste it in **Text**;
   - choose a `.txt` file with **Open file**;
   - pick a generated test stream from **Test input** (section 4.1).

   The counter shows the number of bytes, up to 2,000,000. A file or stream containing any non-ASCII
   byte is refused, with the position of the first one. An opened file or a generated stream is used
   verbatim, byte for byte; while one is active the **Text** box is disabled, and **Clear** returns to
   it.
2. Choose the **Transform**. Each is named by its calc number and namespace. The default is calc32
   SPAN Transparent.
3. **Tokens** and **Line breaks** work as in section 3.1.
4. Set **File name**. The extension is always `.HTM`: `result`, `result.html` and `result.HTM.html` all
   become `result.HTM`.
5. Press **Download .HTM**.

The panels below show:

- **ASCII hex**: the text as two-digit uppercase hexadecimal bytes;
- **Output**: the size of the file, a coloured preview for the HTML-colour transforms (calc28, 29, 32,
  33), and the file's first bytes in hexadecimal.

**Save hex .txt** saves the hexadecimal as a text file: the 16-row hexadecimal escapement grid, a blank
line, then the bytes, 16 per line.

**ASCII escapement** shows the 128 ASCII characters as eight columns of sixteen, with each character's
hexadecimal value.

The status line names the transform's namespace, its table size (128 or 256 entries) and the SHA-256
of the MDQNM source file its table was taken from.

### 4.1 Test input: 1971 teletype streams

**Test input** builds a one-mebibyte (1,048,576-byte) capture of the kind of traffic a Teletype
**Model 33 ASR** or **Model 37 ASR** carried around 1971, to exercise a byte-oriented parser, terminal
emulator or serial handler. Every byte is `00`–`7F` (the high bit is left `0`, so an ordinary character
keeps its leading zero), and the raw control bytes are embedded, not written out as text.

- Choosing a model generates a fresh stream. **New seed** makes another; **Save .txt** downloads the
  exact bytes as a `.txt` file (HxD shows the hex of each byte); **Clear** returns to the Text box.
- The controls row reports the model, the byte count, the number of sessions and the **seed**. The
  seed makes a stream reproducible: `python3 tools/asr33_gen.py --seed N` (in the repository) writes the
  identical file, because the page is a byte-for-byte port of that script, checked in the test suite.
- Each stream mixes the traffic types of its machine: Model 33 — tape messages (blank-tape leader,
  a WRU/answerback exchange, `DC1`–`DC4` reader and punch control, `ZCZC`…`NNNN`, `RUB OUT`
  corrections), WMO weather bulletins (`SOH`…`ETX`), DEC-style console sessions (`^C`, `^U`, `^O`,
  `SUB`, the TECO `ALT MODE`), and off-line tape punching; Model 37 adds mixed case, `HT`/`VT`/`FF`
  layout, `SO`/`SI` alternate-set (Greek) runs, `BS` underlining, half-line `ESC` motions for
  subscripts, and Unix-style sessions with `nroff` output.
- Both also include a synchronous **ASCII Bisync (BSC)** block layer — `SYN` idle, an `ENQ` bid,
  `SOH` header and `STX` text closed by `ETB`/`ETX` with an LRC check byte, alternating `ACK0`/`ACK1`
  acknowledgements, the occasional `NAK`-and-resend, `DLE`-stuffed transparent blocks, `CAN`, and
  `EOT`/`DLE EOT` to end — so the source framing bytes are present, not left out.

A generated stream feeds the Transform like any other input: pick a transform and press
**Download .HTM**, or **Save hex .txt** for its hexadecimal. The streams are also available on the
command line, `node bin/gigaspeak.mjs` aside, as the standalone `tools/asr33_gen.py` and
`tools/asr37_gen.py`.

---

## 5. Grammars

Each byte from 00 to 7F becomes one SPAN tag with a foreground and a background colour. The colours
carry the byte's seven bits, so every grammar can be decoded exactly.

| grammar | colours | tags | what is seen |
|---|---|---|---|
| **SPAN Transparent** | `#RRGGBBAA` | closed, with the character inside | the text, in colour; opacity equals the byte value |
| **SPAN Transparent Zero · Opening Tags** | `#RRGGBBAA` | opening tag only; tokens nest | nothing but colour |
| **SPAN Transparent Zero · Closing Tags** | `#RRGGBBAA` | closed, empty | nothing but colour |
| **Calc28 Full SPAN** | `#RRGGBB` | closed, with the character inside | the text, in full colour |
| **Span Zero** | `#RRGGBB` | opening tag only; tokens nest | nothing |
| **Span Zero · Closing Tags** | `#RRGGBB` | closed, empty | coloured blocks |

For readable output, use **SPAN Transparent** or **Calc28 Full SPAN**. The zero grammars carry the
same bytes with no visible text; use **show byte labels** on the transmission page to read them.

The Grammars tab lists the six with the token each produces for the letter A, and draws all 128 bytes
in the grammar chosen under **All 128 bytes**; pointing at a cell shows its byte and colours.

---

## 6. Local use (optional)

Two options need a program running on the computer, because a web page alone cannot provide them:
the **Literal A.B.C.D:PORT** authority and the **JVM** engine source. With Node 20 or later:

```bash
git clone git@github.com:nth-member/gigaspeak.git
cd gigaspeak
node server.mjs
```

Then open **http://127.0.0.1:8814/**. The page detects the server and enables both options.

- **Literal authority** opens a separate Firefox window, set to route every address through the local
  server, so that the random address appears in its address bar and still loads.
- **JVM engine** is available when an Alien Corridor Support System is running at
  `http://127.0.0.1:7777` (another address can be given in the environment variable
  `GIGASPEAK_ENGINE_ORIGIN`).

The same codecs are available on the command line:

```bash
node bin/gigaspeak.mjs grammars                                  # list the grammars
node bin/gigaspeak.mjs encode -g calc28-span "STX Hello ETX"     # message -> SPAN document
node bin/gigaspeak.mjs url -f https://nth-member.github.io/gigaspeak/render.html "Hello"
node bin/gigaspeak.mjs decode "<a transmission address>"         # grammar, hex and text
node bin/gigaspeak.mjs inspect 41                                # one byte in all six grammars
node bin/gigaspeak.mjs transforms                                # the 26 Communicator transforms
node bin/gigaspeak.mjs htm t09.1 letter.txt                      # letter.txt -> letter.HTM
```

`npm test` runs the test suite.

---

## 7. URL length and the query string

A transmission is carried entirely in its address, and each byte of text takes 75 to 95 characters of
address once its SPAN tag is percent-encoded. The length of the address is therefore the binding limit,
and it differs between the two carriers.

### 7.1 The limits

| limit | applies to | value | consequence |
|---|---|---|---|
| GitHub Pages request limit | **query string** on the published site | a request target (path and query) of about 8,190 characters | a longer address is answered with GitHub's **414 URI Too Long** page and never reaches Gigaspeak |
| Gigaspeak's hosted query budget | **query string** on the published site | 8,000 characters of address | keeps every generated address below GitHub's limit: 85 to 105 bytes of text |
| Firefox's maximum address length | **both carriers**, everywhere | the setting `network.standard-url.max-length` less 4: **1,048,572** characters by default | a longer address is refused outright (section 7.2) |
| Gigaspeak's fragment and local budget | **fragment**, and **query string** on a local server | the limit measured in the viewer's browser: 1,048,572 in a default Firefox | about 11,000 bytes of text in SPAN Transparent |

The GitHub figure was measured against nth-member.github.io on 2026-09-29: request targets up to
8,186 characters were served, and from 8,198 characters GitHub answered 414. GitHub does not publish
this limit, and it may change; the 8,000-character budget leaves a small margin.

The Firefox figure was measured on Firefox 155. Its setting is 1,048,576, but its address parser
accepts at most the setting less 4; this held with the setting at 1, 4 and 8 MiB. Other browsers have
their own maximum lengths, which Gigaspeak does not measure; in them it uses the Firefox default. If a
long fragment address does not open in another browser, lower the **URL budget** (section 1.3) and
constitute again.

### 7.2 What happens at the limit, and raising it

An address longer than the browser accepts is **not opened at all**. Firefox does not shorten it and
shows no error page: a link to it does nothing, and a page that tries to open it receives an error
instead. Gigaspeak therefore never builds an address longer than the measured limit, and the Speak and
Build URL tabs state it in red when a typed budget or message would exceed it.

Firefox's limit can be raised, and Gigaspeak then uses it:

1. Open `about:config` in Firefox and accept the warning.
2. Search for `network.standard-url.max-length`.
3. Edit the value (default `1048576`), for example to `4194304`, and confirm.
4. Reload Gigaspeak. **URL budget** now shows the new automatic limit (`4,194,300` in this example).

With the setting at 4,194,304, a fragment transmission of 4,194,243 characters opened and was validated
in full: 45,001 bytes of text in SPAN Transparent, and 55,922 bytes in Span Zero, against about 11,000
and 14,000 at the default. The raised limit applies only in that Firefox: **a link longer than 1,048,572
characters opens only in a Firefox whose setting has been raised at least as far**, so such links are
for your own use or for recipients who have made the same change. The query carrier on the published
site stays at 8,000 characters whatever the setting, because that limit is GitHub's.

### 7.3 Further differences

- **What the server receives.** A query string is part of the request, so GitHub's servers receive the
  whole transmission and may record it in their logs. A fragment (everything after `#`) is never sent to
  any server; `render.html` reads and checks it in the browser.
- **What reaches other sites.** When a link is followed from the transmission page to another site,
  current browsers send at most the origin (`https://nth-member.github.io/`) as the referrer, neither the
  query nor the fragment.
- **What is kept.** Both carriers are stored in full in the browser's history, like any address.
- **Sharing.** Messaging applications, e-mail programs and link shorteners may cut or refuse very long
  addresses. A query-string address of at most 8,000 characters is the safer form to send; a
  1-million-character fragment address is best opened on the same computer or copied as a file.
- **Local server.** The local server (section 6) accepts request targets of up to 32 MiB, so a query
  address there is limited by the browser alone.
- **Other renderers.** An address built for another server (**Renderer** and **Port** on the Build URL
  tab) is subject to that server's limit, not GitHub's.

### 7.4 Which to use

| purpose | carrier |
|---|---|
| a short message to send to someone | query string (up to 85–105 bytes of text) or fragment |
| the longest possible transmission, as the Speak tab produces by default | fragment |
| keeping the transmission away from any server | fragment |
| a renderer that must receive the transmission on the server side | query string, within that server's limit |

---

## 8. When something goes wrong

| message or symptom | cause and remedy |
|---|---|
| **The browser blocked the new tab** | Pop-ups are blocked for the site. Use **Open the transmission ↗**, or allow pop-ups for nth-member.github.io. |
| **Could not load …** or a source returned HTTP … | The engine's files could not be downloaded, usually because the connection is offline. Retry when online, or use **Text I supply**. |
| **Transmission rejected** | The address was altered or truncated, or names the wrong grammar. Copy the address again in full. |
| **Expected exactly one html field** | The address has no transmission, or two. |
| A GitHub page reading **414 URI Too Long** | A query-string address is longer than GitHub Pages accepts (section 7.1). Use the Fragment carrier, or shorten the message. |
| **Non-ASCII character at …** | The text contains a character outside ASCII. Replace it; in Speak, the engine's output is converted automatically (non-ASCII becomes `?`). |
| **The address is … characters; this browser accepts at most …** | The URL budget or the message exceeds the browser's limit (section 7.2). Lower the budget, shorten the message, or raise Firefox's setting. |
| The transmission looks nearly empty | A zero grammar, or low byte values drawn with low opacity (section 2). Tick **show byte labels**. |
| **Input is … bytes; the limit is 2,000,000** | The Communicator's limit. Split the text. |
