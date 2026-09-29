/* The MDQNM engine, run in the browser by SCI (scittle), from its original source.

   Nothing in the engine's .clj files is changed. What the JVM supplied, this
   supplies, and only that:

     java.util.Date          Date resolves to the JS Date; (import '[java.util Date]) is then a no-op;
                             (. (new Date) getTime) is then the same epoch-ms reading
     clj-time.coerce         from-long -> a DateTime that prints as Joda's does
     clj-time.local          local-now -> a DateTime in the machine's zone
     clj-time.core           present, as required; the engine calls nothing in it
     agent / send            an agent is a reference whose send applies at once
                             (the browser has one thread; the JVM applies it on a pool);
                             a failing action leaves it failed, as on the JVM, and
                             arithmetic on the agent itself is a ClassCastException

   Loading follows the JVM's `require ... :reload`: the file is read form by form;
   a (require 'engine.ns :reload) loads that namespace first, recursively, its output
   included, exactly where the JVM would. The JVM's compile-time warning for a
   (def *earmuffed* ...) that is not ^:dynamic is printed in the same words, with
   the same file and line, at the same point in the output.

   Known and declared differences: numbers print the JavaScript way (12480 for
   12480.0; no exact ratios, so (/ 1000 7) is 142.857...); integers are exact to
   2^53 rather than 2^63; clocks read the visitor's device clock.
*/
(function (root) {
  "use strict";

  const PRELUDE = `
(in-ns 'clojure.core)
; An import makes a Java class resolvable by its short name. Date is the only
; class the engine imports; it resolves through clojure.core, which every
; namespace refers, so the import itself has nothing left to do -- and, as on
; the JVM, it creates no var that (refer ...) could carry into another namespace.
(def Date js/Date)
(defmacro import [& specs] nil)
;; An agent is a reference whose actions apply at once (one thread here, a pool on
;; the JVM). As on the JVM it prints as #object[clojure.lang.Agent 0x.. {:status ..,
;; :val ..}]; using the agent itself as a number is a ClassCastException; an action
;; that throws does not fail the send but leaves the agent :failed with its last
;; good state, and every later send then throws.
(defprotocol AcssAgent (-acss-act [a f args]))
(deftype Agent [^:mutable state ^:mutable err h]
  IDeref (-deref [_] state)
  AcssAgent
  (-acss-act [this f args]
    (when err (throw (js/Error. "java.lang.RuntimeException: Agent is failed, needs restart")))
    (try (set! state (apply f state args)) (catch :default e (set! err (str e))))
    this)
  IPrintWithWriter
  (-pr-writer [_ w _]
    (-write w (str "#object[clojure.lang.Agent 0x" h " {:status " (if err ":failed" ":ready")
                   ", :val " (pr-str state) "}]"))))
(defn agent [state & _]
  (let [a (->Agent state nil (.toString (rand-int 2147483647) 16))]
    (set! (.-valueOf a)
          (fn [] (throw (js/Error. "java.lang.ClassCastException: clojure.lang.Agent cannot be cast to java.lang.Number"))))
    a))
(defn send [a f & args] (-acss-act a f args))
(def send-off send)
;; Output goes where the JVM's *out* would: print without a newline, println with.
(alter-var-root #'*print-newline* (constantly true))
(alter-var-root #'*print-fn* (constantly (fn [& xs] (js/ACSS.emit (apply str xs)))))
(alter-var-root #'*print-err-fn* (constantly (fn [& xs] (js/ACSS.emit (apply str xs)))))
(defn await [& _] nil)
;; A Joda DateTime as the engine's output sees it: (str dt) is its ISO text, and
;; pr shows #object[org.joda.time.DateTime 0x........ "ISO"].
(deftype DateTime [ms utc h]
  Object (toString [_] (js/ACSS.iso ms utc))
  IPrintWithWriter
  (-pr-writer [_ w _] (-write w (str "#object[org.joda.time.DateTime 0x" h " " (pr-str (js/ACSS.iso ms utc)) "]"))))
(defn acss-date-time [ms utc] (->DateTime (js/Math.trunc ms) utc (.toString (rand-int 2147483647) 16)))
(ns clj-time.core)
(defn now [] (clojure.core/acss-date-time (.now js/Date) true))
(ns clj-time.coerce)
(defn from-long [ms] (clojure.core/acss-date-time ms true))
(defn to-long [dt] (.-ms dt))
(ns clj-time.local)
(defn local-now [] (clojure.core/acss-date-time (.now js/Date) false))
(in-ns 'user)
`;

  // Joda's ISO form: the year has at least four digits and a sign only when
  // negative (-0446, 40922) -- JavaScript's own is -000446 and +040922. A UTC
  // DateTime ends in Z; a local one carries the machine's offset (+01:00).
  function iso(ms, utc) {
    const joda = t => { const y = new Date(t).getUTCFullYear();
      return new Date(t).toISOString().replace(/^[+-]?\d+/, (y < 0 ? "-" : "") + String(Math.abs(y)).padStart(4, "0")); };
    if (utc) return joda(ms);
    const off = -new Date(ms).getTimezoneOffset(), p = n => String(Math.abs(n)).padStart(2, "0");
    return joda(ms + off * 60000).slice(0, -1) +
           (off === 0 ? "Z" : (off > 0 ? "+" : "-") + p(Math.trunc(off / 60)) + ":" + p(off % 60));
  }

  // Split source into top-level forms, each with its starting line. Strings,
  // comments and character literals are respected.
  function forms(src) {
    const out = []; let i = 0, line = 1, depth = 0, start = -1, sline = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === "\n") { line++; i++; continue; }
      if (ch === ";") { while (i < n && src[i] !== "\n") i++; continue; }
      if (ch === '"') {
        if (depth === 0 && start < 0) { start = i; sline = line; }
        i++;
        while (i < n && src[i] !== '"') { if (src[i] === "\\") i++; else if (src[i] === "\n") line++; i++; }
        i++;
        if (depth === 0) { out.push({ text: src.slice(start, i), line: sline }); start = -1; }
        continue;
      }
      if (ch === "\\") { if (start < 0 && depth === 0) { start = i; sline = line; } i += 2; while (i < n && /[a-z]/i.test(src[i])) i++; if (depth === 0) { out.push({ text: src.slice(start, i), line: sline }); start = -1; } continue; }
      if (ch === "(" || ch === "[" || ch === "{") {
        if (depth === 0 && start < 0) { start = i; sline = line; }
        // reader prefixes directly before the opening bracket belong to the form
        if (depth === 0) { let j = start; while (j > 0 && /['`#^@~]/.test(src[j - 1])) j--; start = j; }
        depth++; i++; continue;
      }
      if (ch === ")" || ch === "]" || ch === "}") {
        depth--; i++;
        if (depth === 0 && start >= 0) { out.push({ text: src.slice(start, i), line: sline }); start = -1; }
        continue;
      }
      if (depth === 0 && !/\s|,/.test(ch)) {
        if (/['`#^@~]/.test(ch)) { i++; continue; }   // prefix of the next form
        let j = i; while (j < n && !/[\s,()\[\]{}";]/.test(src[j])) j++;
        out.push({ text: src.slice(i, j), line }); i = j; continue;
      }
      i++;
    }
    return out;
  }

  const nsPath = ns => ns.replace(/-/g, "_").replace(/\./g, "/") + ".clj";
  const DEF = /^\((?:def|defn|defonce)\s+(\*[^\s*()\[\]]+\*)(?=[\s(\[])/;
  const REQ = /^\(require\s+'([A-Za-z0-9.\-]+)\s*:reload\)$/;
  const NS = /^\(ns\s+([A-Za-z0-9.\-]+)/;

  function Engine(opts) {
    const sc = opts.scittle || root.scittle.core;
    const known = opts.isEngineNs;          // ns -> bool
    const source = opts.source;             // ns -> source text (sync)
    let out = [];
    const emit = s => out.push(s);
    root.ACSS.emit = emit;
    const capture = f => f();
    const evalIn = (ns, text) => sc.eval_string(ns ? "(in-ns '" + ns + ")\n" + text : text);

    evalIn(null, PRELUDE);

    function loadNs(ns, stack) {
      if (stack.includes(ns)) return;
      const src = source(ns);
      if (src == null) throw new Error("Could not locate " + nsPath(ns) + " on classpath.");
      let cur = null;
      for (const f of forms(src)) {
        const t = f.text;
        let m = t.match(NS);
        if (m) { cur = m[1]; evalIn(null, t); continue; }
        m = t.match(REQ);
        if (m && known(m[1])) { loadNs(m[1], stack.concat(ns)); evalIn(cur, t); continue; }
        m = t.match(DEF);
        if (m && !/\^:dynamic/.test(t.slice(0, t.indexOf(m[1])))) {
          emit("Warning: " + m[1] + " not declared dynamic and thus is not dynamically rebindable, " +
               "but its name suggests otherwise. Please either indicate ^:dynamic " + m[1] +
               " or change the name. (" + nsPath(ns) + ":" + f.line + ")\n");
        }
        if (t[0] === "(" || t[0] === "[" || t[0] === "{" || /^['`#]/.test(t)) evalIn(cur, t);
      }
    }

    return {
      load(ns) {
        out = [];
        const t0 = Date.now();
        try { capture(() => loadNs(ns, [])); return { ok: true, out: out.join(""), ms: Date.now() - t0 }; }
        catch (e) { return { ok: false, error: String(e.message || e), out: out.join(""), ms: Date.now() - t0 }; }
      },
      eval(ns, code) {
        out = [];
        try { const v = capture(() => evalIn(ns, "(pr-str (do " + code + "\n))")); return { ok: true, value: v, out: out.join("") }; }
        catch (e) { return { ok: false, error: String(e.message || e), out: out.join("") }; }
      },
      invoke(ns, name, args) {
        return this.eval(ns, "(" + ns + "/" + name + " " + args.join(" ") + ")");
      },
      vars(ns) {
        const code = `(js/JSON.stringify (clj->js (vec (for [[s v] (sort-by (comp str first) (ns-publics '${ns}))
                     :let [x @v]]
                 [(str s) (cond (instance? clojure.core/Agent x) "agent"
                                (= (type x) (type (atom nil))) "atom"
                                (fn? x) "fn" :else "value")
                  (when-not (fn? x) (pr-str (if (or (instance? clojure.core/Agent x) (= (type x) (type (atom nil)))) @x x)))]))))`;
        return JSON.parse(sc.eval_string(code));
      },
      forms, nsPath,
    };
  }

  root.ACSS = Object.assign(root.ACSS || {}, { Engine, iso, forms, nsPath });
})(typeof window !== "undefined" ? window : globalThis);
