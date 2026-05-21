// Conjugation Dojo flow — part of Dojo extension.

function DojoConj({ onExit }) {
  const [phase, setPhase]         = React.useState("setup");
  const [activeForms, setActiveForms] = React.useState(new Set(["te_form", "polite_masu", "polite_mashita"]));
  const [activeClasses, setActiveClasses] = React.useState(new Set(["godan", "ichidan", "irr_suru", "irr_kuru"]));
  const [sessionLen, setSessionLen] = React.useState(20);
  const [queue, setQueue]         = React.useState([]);
  const [qIdx, setQIdx]           = React.useState(0);
  const [streak, setStreak]       = React.useState(0);
  const [best, setBest]           = React.useState(0);
  const [results, setResults]     = React.useState([]);
  const [hanabi, setHanabi]       = React.useState(null);

  const buildQueue = () => {
    const verbs = window.RikizoDojo.conjugationVerbs.filter(v => activeClasses.has(v.verbClass));
    const forms = window.RikizoDojo.conjugationForms.filter(f => activeForms.has(f.key));
    const pairs = [];
    verbs.forEach(v => {
      forms.forEach(f => {
        const conj = dojoConjugate(v, f.key);
        if (conj && conj !== v.surface) {
          pairs.push({ verb: v, form: f, answer: conj, answerReading: dojoConjugateReading(v, f.key) });
        }
      });
    });
    const shuffled = dojoShuffle([...pairs]);
    return sessionLen > 0 ? shuffled.slice(0, sessionLen) : shuffled;
  };

  const startDrill = () => {
    const q = buildQueue();
    if (q.length === 0) return;
    setQueue(q); setQIdx(0); setStreak(0); setBest(0); setResults([]);
    setPhase("drill");
  };

  const onAnswer = (item, userInput, correct) => {
    const ns = correct ? streak + 1 : 0;
    const nb = Math.max(best, ns);
    setStreak(ns); setBest(nb);
    setResults(r => [...r, { item, correct, userInput }]);
    const tier = [...STREAK_TIERS].reverse().find(t => ns >= t.at && ns % t.at === 0);
    if (tier) { setHanabi(tier); setTimeout(() => setHanabi(null), 1800); }
    if (qIdx + 1 >= queue.length) { setPhase("summary"); return; }
    setQIdx(i => i + 1);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {phase === "setup"   && <ConjSetup activeForms={activeForms} setActiveForms={setActiveForms} activeClasses={activeClasses} setActiveClasses={setActiveClasses} sessionLen={sessionLen} setSessionLen={setSessionLen} onStart={startDrill} onExit={onExit} />}
      {phase === "drill"   && <ConjDrill queue={queue} qIdx={qIdx} streak={streak} best={best} onAnswer={onAnswer} onExit={onExit} />}
      {phase === "summary" && <ConjSummary results={results} best={best} onRetry={() => { setQueue(dojoShuffle([...queue])); setQIdx(0); setStreak(0); setResults([]); setPhase("drill"); }} onNew={() => setPhase("setup")} onExit={onExit} />}
      {hanabi && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 52, fontWeight: 600, color: hanabi.color, textAlign: "center", animation: "hanabiPop 1.8s ease forwards" }}>
            {hanabi.msg}<div style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 500, marginTop: 4 }}>{hanabi.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConjSetup({ activeForms, setActiveForms, activeClasses, setActiveClasses, sessionLen, setSessionLen, onStart, onExit }) {
  const forms = window.RikizoDojo.conjugationForms;
  const vcOptions = [
    { key: "godan",    label: "Godan" },
    { key: "ichidan",  label: "Ichidan" },
    { key: "irr_suru", label: "する" },
    { key: "irr_kuru", label: "来る" },
  ];
  const toggleForm = (key) => setActiveForms(s => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const toggleClass = (key) => setActiveClasses(s => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const groupedForms = {};
  forms.forEach(f => { if (!groupedForms[f.group]) groupedForms[f.group] = []; groupedForms[f.group].push(f); });

  const darkBack = {
    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
    border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--washi)",
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      <div style={{ padding: "54px 20px 16px", background: "var(--ink)", color: "var(--washi)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onExit} style={darkBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--indigo)", letterSpacing: "0.18em", fontWeight: 600 }}>CONJUGATION DOJO</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--washi)", marginTop: 1 }}>Set up your drill</div>
        </div>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "18px 20px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <MetaLabel>Verb types</MetaLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {vcOptions.map(opt => {
              const on = activeClasses.has(opt.key);
              return (
                <button key={opt.key} onClick={() => toggleClass(opt.key)} style={{
                  padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                  background: on ? "var(--ink)" : "var(--washi)",
                  color: on ? "var(--washi)" : "var(--ink-2)",
                  border: on ? "none" : "1px solid var(--hairline)",
                  fontFamily: "var(--font-jp-display)", fontSize: 15, fontWeight: 500,
                  transition: "all 0.12s",
                }}>{opt.label}</button>
              );
            })}
          </div>
        </div>

        {Object.entries(groupedForms).map(([group, fms]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <MetaLabel>{group}</MetaLabel>
              <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
            </div>
            {fms.map(f => {
              const on = activeForms.has(f.key);
              return (
                <button key={f.key} onClick={() => toggleForm(f.key)} style={{
                  width: "100%", textAlign: "left", marginBottom: 7,
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: on ? "var(--washi-2)" : "var(--washi)",
                  border: on ? "1px solid var(--ink)" : "1px solid var(--hairline)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  transition: "all 0.12s",
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: on ? "var(--ink)" : "var(--washi-3)", border: on ? "none" : "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                      {Object.entries(f.rules).map(([k,v]) => `${k}: ${v}`).join(" · ")}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--indigo)", letterSpacing: "0.1em", fontWeight: 700 }}>{f.gLesson}</div>
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ marginBottom: 22 }}>
          <MetaLabel>Session length</MetaLabel>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {[10, 20, 30, 0].map(n => (
              <button key={n} onClick={() => setSessionLen(n)} style={{
                flex: 1, padding: "10px 6px", borderRadius: 8, cursor: "pointer",
                background: sessionLen === n ? "var(--ink)" : "var(--washi)",
                color: sessionLen === n ? "var(--washi)" : "var(--ink-2)",
                border: sessionLen === n ? "none" : "1px solid var(--hairline)",
                fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
                transition: "all 0.12s",
              }}>{n === 0 ? "All" : n}</button>
            ))}
          </div>
        </div>

        <button onClick={onStart} disabled={activeForms.size === 0 || activeClasses.size === 0} style={{
          width: "100%", padding: "15px", borderRadius: 999,
          background: (activeForms.size > 0 && activeClasses.size > 0) ? "var(--ink)" : "var(--hairline)",
          color: (activeForms.size > 0 && activeClasses.size > 0) ? "var(--washi)" : "var(--ink-3)",
          border: "none", cursor: (activeForms.size > 0 && activeClasses.size > 0) ? "pointer" : "not-allowed",
          fontSize: 14, fontWeight: 700,
        }}>
          Start drill
        </button>
      </div>
    </div>
  );
}

function ConjDrill({ queue, qIdx, streak, best, onAnswer, onExit }) {
  const item = queue[qIdx];
  const [input, setInput]           = React.useState("");
  const [submitted, setSubmitted]   = React.useState(false);
  const [correct, setCorrect]       = React.useState(null);
  const [showHelper, setShowHelper] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setInput(""); setSubmitted(false); setCorrect(null); setShowHelper(false);
    if (inputRef.current) setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  }, [qIdx]);

  const submit = () => {
    if (submitted || !input.trim()) return;
    setSubmitted(true);
    const ok = input.trim() === item.answer || input.trim() === item.answerReading;
    setCorrect(ok);
    if (ok) setTimeout(() => onAnswer(item, input.trim(), true), 900);
  };

  const diff = submitted && !correct ? buildConjDiff(input.trim(), item.answer) : null;
  const hint = getConjHint(item);

  const darkBack = {
    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
    border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--washi)",
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      <div style={{ padding: "54px 20px 14px", background: "var(--ink)", color: "var(--washi)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onExit} style={darkBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--indigo)", letterSpacing: "0.18em", fontWeight: 600 }}>CONJUGATION DOJO</div>
          <div className="mono" style={{ fontSize: 11, color: "oklch(0.97 0.008 80 / 0.5)", letterSpacing: "0.08em", marginTop: 1 }}>{qIdx + 1} / {queue.length}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: streak > 0 ? "oklch(0.75 0.12 85)" : "oklch(0.97 0.008 80 / 0.35)", lineHeight: 1 }}>{streak}</div>
          <div className="mono" style={{ fontSize: 8.5, color: "oklch(0.97 0.008 80 / 0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>streak</div>
        </div>
      </div>
      <div style={{ height: 3, background: "var(--hairline)" }}>
        <div style={{ height: "100%", background: "var(--indigo)", borderRadius: 999, width: `${(qIdx / queue.length) * 100}%`, transition: "width 0.3s ease" }}/>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "24px 20px 32px" }}>
        <div style={{
          padding: "24px 20px", textAlign: "center", marginBottom: 24,
          background: submitted ? (correct ? "oklch(0.94 0.04 140)" : "oklch(0.94 0.04 30)") : "var(--washi-2)",
          border: `2px solid ${submitted ? (correct ? "oklch(0.65 0.1 140)" : "oklch(0.6 0.16 30)") : "var(--hairline)"}`,
          borderRadius: "var(--r-xl)", transition: "all 0.2s",
        }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 68, fontWeight: 500, lineHeight: 1, color: "var(--ink)", marginBottom: 6 }}>{item.verb.surface}</div>
          <div className="jp-sans" style={{ fontSize: 16, color: "var(--ink-2)", marginBottom: 4 }}>{item.verb.reading}</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginBottom: 14 }}>{item.verb.meaning}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--washi)", border: "1px solid var(--hairline)" }}>
            <span style={{ color: "var(--vermilion)", fontSize: 14 }}>→</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{item.form.label}</span>
            <span className="mono" style={{ fontSize: 9, color: "var(--indigo)", letterSpacing: "0.12em", fontWeight: 700 }}>{item.form.gLesson}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 999, background: "var(--washi-3)", border: "1px solid var(--hairline)", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.verb.verbClass}</span>
            {item.verb.falseIchidan && <span style={{ marginLeft: 6, padding: "3px 10px", borderRadius: 999, background: "oklch(0.95 0.06 80)", border: "1px solid oklch(0.75 0.1 80)", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "oklch(0.45 0.12 65)", letterSpacing: "0.1em", textTransform: "uppercase" }}>⚠ false ichidan</span>}
          </div>
        </div>

        {!submitted && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
              lang="ja" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck="false"
              placeholder="Type conjugated form..."
              style={{ flex: 1, padding: "14px 16px", borderRadius: "var(--r-md)", border: "2px solid var(--hairline)", background: "var(--washi)", fontFamily: "var(--font-jp)", fontSize: 20, color: "var(--ink)", outline: "none" }}
            />
            <button onClick={submit} style={{ padding: "0 20px", borderRadius: "var(--r-md)", background: "var(--ink)", border: "none", color: "var(--washi)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Go</button>
          </div>
        )}

        {submitted && correct && (
          <div style={{ textAlign: "center", padding: "16px", animation: "glossFadeIn 0.2s ease" }}>
            <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 700, color: "var(--moss)" }}>正解！</div>
          </div>
        )}

        {submitted && !correct && (
          <div style={{ animation: "glossFadeIn 0.2s ease" }}>
            <div style={{ textAlign: "center", fontFamily: "var(--font-jp-display)", fontSize: 20, fontWeight: 700, color: "var(--vermilion)", marginBottom: 12 }}>残念！</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
              {diff && diff.map((d, i) => (
                <div key={i} style={{ width: 36, height: 40, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-jp)", fontSize: 20, fontWeight: 600, background: d.status === "ok" ? "oklch(0.9 0.06 140)" : d.status === "wrong" ? "oklch(0.9 0.06 30)" : "oklch(0.92 0.07 80)", color: d.status === "ok" ? "oklch(0.35 0.1 140)" : d.status === "wrong" ? "oklch(0.4 0.14 30)" : "oklch(0.4 0.1 65)", textDecoration: d.status === "wrong" ? "line-through" : "none" }}>{d.char}</div>
              ))}
            </div>
            <div style={{ padding: "14px 16px", background: "var(--washi)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", marginBottom: 14 }}>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Correct answer</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="jp-serif" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{item.answer}</span>
                <span className="jp-sans" style={{ fontSize: 16, color: "var(--ink-3)" }}>{item.answerReading}</span>
              </div>
            </div>
            {hint && <div style={{ padding: "10px 14px", background: "oklch(0.93 0.05 250)", border: "1px solid oklch(0.7 0.08 250)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14 }}><strong style={{ color: "var(--indigo)" }}>Hint · </strong>{hint}</div>}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <button onClick={() => setShowHelper(s => !s)} style={{ padding: "6px 14px", borderRadius: 999, cursor: "pointer", background: "transparent", border: "1px solid var(--hairline)", color: "var(--indigo)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{showHelper ? "Hide helper" : "て-form helper"}</button>
            </div>
            {showHelper && (
              <div style={{ padding: "12px 14px", background: "var(--washi)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", marginBottom: 14 }}>
                <MetaLabel>て-form rules</MetaLabel>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["く","いて","var(--vermilion)"],["ぐ","いで","var(--vermilion)"],["す","して","var(--moss)"],["む/ぶ/ぬ","んで","var(--indigo)"],["う/つ/る","って","var(--gold)"],["Ichidan","drop る + て","var(--ink-3)"],["する","して","var(--ink-3)"],["行く ⚠","行って","var(--ink-3)"]].map(([end,res,col],i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span className="jp-serif" style={{ fontSize: 13, fontWeight: 600, color: col }}>{end}</span>
                      <span style={{ fontSize: 10, color: "var(--ink-3)" }}>→</span>
                      <span className="jp-serif" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{res}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => onAnswer(item, input.trim(), false)} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "var(--ink)", border: "none", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConjSummary({ results, best, onRetry, onNew, onExit }) {
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const mistakes = results.filter(r => !r.correct);
  const byForm = {};
  results.forEach(r => {
    const k = r.item.form.label;
    if (!byForm[k]) byForm[k] = { correct: 0, total: 0 };
    byForm[k].total++;
    if (r.correct) byForm[k].correct++;
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--ink)" }}>
      <div style={{ padding: "54px 20px 14px" }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>RESULTS</div>
      </div>
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "8px 22px 40px", color: "var(--washi)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Hanko size={64} rotate={-8}>完</Hanko>
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: pct >= 75 ? "oklch(0.7 0.12 140)" : "var(--vermilion)" }}>{pct}%</div>
          <div className="mono" style={{ fontSize: 11, color: "oklch(0.97 0.008 80 / 0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>{correct} / {total} correct · best {best}</div>
        </div>
        <div style={{ background: "oklch(0.97 0.008 80 / 0.06)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 20 }}>
          {Object.entries(byForm).map(([form, s], i) => (
            <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.97 0.008 80 / 0.08)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--washi)" }}>{form}</div>
              <div className="mono" style={{ fontSize: 11, color: s.correct === s.total ? "oklch(0.7 0.12 140)" : "oklch(0.7 0.12 30)", fontWeight: 600 }}>{s.correct}/{s.total}</div>
            </div>
          ))}
        </div>
        {mistakes.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <MetaLabel color="oklch(0.97 0.008 80 / 0.5)">Mistakes</MetaLabel>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
              {mistakes.slice(0,5).map((r,i) => (
                <div key={i} style={{ padding: "10px 14px", background: "oklch(0.97 0.008 80 / 0.06)", borderRadius: "var(--r-sm)", display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="jp-serif" style={{ fontSize: 20, color: "var(--washi)", fontWeight: 500 }}>{r.item.verb.surface}</span>
                  <span style={{ fontSize: 11, color: "oklch(0.97 0.008 80 / 0.5)" }}>→ {r.item.form.label}</span>
                  <span className="jp-serif" style={{ marginLeft: "auto", fontSize: 16, fontWeight: 600, color: "oklch(0.7 0.12 140)" }}>{r.item.answer}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {mistakes.length > 0 && <button onClick={onRetry} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "var(--vermilion)", border: "none", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Retry mistakes ({mistakes.length})</button>}
          <button onClick={onNew} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "oklch(0.97 0.008 80 / 0.1)", border: "1px solid oklch(0.97 0.008 80 / 0.2)", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>New session</button>
          <button onClick={onExit} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "transparent", border: "1px solid oklch(0.97 0.008 80 / 0.15)", color: "oklch(0.97 0.008 80 / 0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Back to Dojo</button>
        </div>
      </div>
    </div>
  );
}

// ── Conjugation engine ────────────────────────────────────────
function dojoConjugate(verb, formKey) {
  const surface = verb.surface, reading = verb.reading, vc = verb.verbClass;
  if (formKey === "polite_masu") {
    if (vc === "irr_suru") return "します";
    if (vc === "irr_kuru") return "来ます";
    if (vc === "ichidan") return surface.slice(0, -1) + "ます";
    return conjStem(surface, reading) + "ます";
  }
  if (formKey === "polite_mashita") {
    if (vc === "irr_suru") return "しました";
    if (vc === "irr_kuru") return "来ました";
    if (vc === "ichidan") return surface.slice(0, -1) + "ました";
    return conjStem(surface, reading) + "ました";
  }
  if (formKey === "polite_negative") {
    if (vc === "irr_suru") return "しません";
    if (vc === "irr_kuru") return "来ません";
    if (vc === "ichidan") return surface.slice(0, -1) + "ません";
    return conjStem(surface, reading) + "ません";
  }
  if (formKey === "te_form") {
    if (vc === "irr_suru") return "して";
    if (vc === "irr_kuru") return "来て";
    if (vc === "ichidan") return surface.slice(0, -1) + "て";
    return conjGodanTe(surface, reading, "て", "で");
  }
  if (formKey === "plain_past") {
    if (vc === "irr_suru") return "した";
    if (vc === "irr_kuru") return "来た";
    if (vc === "ichidan") return surface.slice(0, -1) + "た";
    return conjGodanTe(surface, reading, "た", "だ");
  }
  if (formKey === "desire_tai") {
    if (vc === "irr_suru") return "したいです";
    if (vc === "irr_kuru") return "来たいです";
    if (vc === "ichidan") return surface.slice(0, -1) + "たいです";
    return conjStem(surface, reading) + "たいです";
  }
  if (formKey === "polite_volitional_mashou") {
    if (vc === "irr_suru") return "しましょう";
    if (vc === "irr_kuru") return "来ましょう";
    if (vc === "ichidan") return surface.slice(0, -1) + "ましょう";
    return conjStem(surface, reading) + "ましょう";
  }
  return null;
}

function dojoConjugateReading(verb, formKey) {
  const r = verb.reading, vc = verb.verbClass;
  const uToI = {"う":"い","く":"き","ぐ":"ぎ","す":"し","つ":"ち","ぬ":"に","ぶ":"び","む":"み","る":"り"};
  const rStem = r.slice(0, -1) + (uToI[r.slice(-1)] || r.slice(-1));
  if (formKey === "polite_masu")           { if (vc==="irr_suru") return "します"; if (vc==="irr_kuru") return "きます"; if (vc==="ichidan") return r.slice(0,-1)+"ます"; return rStem+"ます"; }
  if (formKey === "polite_mashita")        { if (vc==="irr_suru") return "しました"; if (vc==="irr_kuru") return "きました"; if (vc==="ichidan") return r.slice(0,-1)+"ました"; return rStem+"ました"; }
  if (formKey === "polite_negative")       { if (vc==="irr_suru") return "しません"; if (vc==="irr_kuru") return "きません"; if (vc==="ichidan") return r.slice(0,-1)+"ません"; return rStem+"ません"; }
  if (formKey === "te_form")               { if (vc==="irr_suru") return "して"; if (vc==="irr_kuru") return "きて"; if (vc==="ichidan") return r.slice(0,-1)+"て"; return conjGodanTeR(r,"て","で"); }
  if (formKey === "plain_past")            { if (vc==="irr_suru") return "した"; if (vc==="irr_kuru") return "きた"; if (vc==="ichidan") return r.slice(0,-1)+"た"; return conjGodanTeR(r,"た","だ"); }
  if (formKey === "desire_tai")            { if (vc==="irr_suru") return "したいです"; if (vc==="irr_kuru") return "きたいです"; if (vc==="ichidan") return r.slice(0,-1)+"たいです"; return rStem+"たいです"; }
  if (formKey === "polite_volitional_mashou") { if (vc==="irr_suru") return "しましょう"; if (vc==="irr_kuru") return "きましょう"; if (vc==="ichidan") return r.slice(0,-1)+"ましょう"; return rStem+"ましょう"; }
  return null;
}

function conjStem(surface, reading) {
  const uToI = {"う":"い","く":"き","ぐ":"ぎ","す":"し","つ":"ち","ぬ":"に","ぶ":"び","む":"み","る":"り"};
  return surface.slice(0,-1) + (uToI[reading.slice(-1)] || reading.slice(-1));
}
function conjGodanTe(surface, reading, te, de) {
  const last = reading.slice(-1), stem = surface.slice(0,-1);
  if (reading === "いく") return "行って";
  if (["む","ぶ","ぬ"].includes(last)) return stem+"ん"+de;
  if (last === "く") return stem+"い"+te;
  if (last === "ぐ") return stem+"い"+de;
  if (last === "す") return stem+"し"+te;
  if (["う","つ","る"].includes(last)) return stem+"っ"+te;
  return surface;
}
function conjGodanTeR(reading, te, de) {
  const last = reading.slice(-1), stem = reading.slice(0,-1);
  if (reading === "いく") return "いって";
  if (["む","ぶ","ぬ"].includes(last)) return stem+"ん"+de;
  if (last === "く") return stem+"い"+te;
  if (last === "ぐ") return stem+"い"+de;
  if (last === "す") return stem+"し"+te;
  if (["う","つ","る"].includes(last)) return stem+"っ"+te;
  return reading;
}
function buildConjDiff(userInput, expected) {
  const result = []; let p = 0;
  while (p < userInput.length && p < expected.length && userInput[p] === expected[p]) p++;
  for (let i = 0; i < p; i++) result.push({ char: userInput[i], status: "ok" });
  for (let i = p; i < userInput.length; i++) result.push({ char: userInput[i], status: "wrong" });
  for (let i = p; i < expected.length; i++) result.push({ char: expected[i], status: "missing" });
  return result;
}
function getConjHint({ form, verb }) {
  if (form.key === "te_form" && verb.verbClass === "godan") {
    const last = verb.reading.slice(-1);
    if (["む","ぶ","ぬ"].includes(last)) return `${last} → んで group`;
    if (last === "く") return "く → いて";
    if (last === "ぐ") return "ぐ → いで";
    if (last === "す") return "す → して";
    if (["う","つ","る"].includes(last)) return `${last} → って group`;
  }
  if (verb.falseIchidan) return "⚠ Looks ichidan but conjugates as godan!";
  return null;
}

Object.assign(window, { DojoConj });
