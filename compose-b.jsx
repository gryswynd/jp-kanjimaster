// Compose module — Part B: ComposeView (writing + tracking + score).

function ComposeView({ id, onBack }) {
  const data = window.RikizoCompose.active; // always use N5.9 for the demo
  const allPrompts = [...(data.prompts || []), ...(data.challengePrompts || [])];

  const [text, setText]           = React.useState(() => localStorage.getItem("compose_draft_" + id) || "");
  const [promptIdx, setPromptIdx] = React.useState(() => {
    const s = localStorage.getItem("compose_idx_" + id);
    return s ? Math.min(parseInt(s, 10), allPrompts.length - 1) : 0;
  });
  const [showBank, setShowBank]   = React.useState(false);
  const [showScore, setShowScore] = React.useState(false);
  const [showModel, setShowModel] = React.useState(false);
  const textareaRef = React.useRef(null);

  const currentPrompt = allPrompts[promptIdx];
  const isChallenge = promptIdx >= (data.prompts || []).length;
  const isLastPrompt = promptIdx === allPrompts.length - 1;

  // Count how many times each match appears in text
  const countMatch = (matches) => {
    let n = 0;
    matches.forEach(m => {
      let idx = 0;
      while ((idx = text.indexOf(m, idx)) !== -1) { n++; idx += m.length; }
    });
    return n;
  };

  // Check if all targets of current prompt are met
  const targetsMet = currentPrompt.targets.every(t => countMatch(t.matches) >= t.count);
  const allComplete = allPrompts.every((p, i) => {
    if (i < promptIdx) return true; // previously completed
    if (i === promptIdx) return targetsMet;
    return false;
  }) && targetsMet && isLastPrompt;

  // Progress: how many targets total met across all prompts
  const { totalMet, totalTargets } = React.useMemo(() => {
    let met = 0, total = 0;
    allPrompts.forEach((p, i) => {
      total += p.targets.length;
      if (i < promptIdx) met += p.targets.length;
      else if (i === promptIdx) {
        p.targets.forEach(t => { if (countMatch(t.matches) >= t.count) met++; });
      }
    });
    return { totalMet: met, totalTargets: total };
  }, [text, promptIdx]);

  const pct = totalTargets > 0 ? Math.round((totalMet / totalTargets) * 100) : 0;

  const handleText = (e) => {
    const v = e.target.value;
    setText(v);
    localStorage.setItem("compose_draft_" + id, v);
  };

  const advance = () => {
    const next = Math.min(promptIdx + 1, allPrompts.length - 1);
    setPromptIdx(next);
    setShowModel(false);
    localStorage.setItem("compose_idx_" + id, String(next));
  };

  const insertWord = (word) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const newText = text.slice(0, start) + word + text.slice(end);
    setText(newText);
    localStorage.setItem("compose_draft_" + id, newText);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + word.length; ta.focus(); }, 0);
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)", position: "relative" }}>
      {/* Header */}
      <div style={{
        padding: "54px 20px 14px", background: "var(--ink)", color: "var(--washi)",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button onClick={onBack} style={compBackBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--moss)", letterSpacing: "0.18em", fontWeight: 600 }}>COMPOSE · {data.lesson}</div>
          <div className="jp-serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--washi)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.title}</div>
        </div>
        <button onClick={() => setShowScore(true)} style={{
          padding: "7px 14px", borderRadius: 999, cursor: "pointer",
          background: "var(--moss)", border: "none", color: "var(--washi)",
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
          textTransform: "uppercase", fontWeight: 700, flexShrink: 0,
        }}>Score</button>
      </div>

      {/* Progress rail */}
      <div style={{ height: 3, background: "var(--hairline)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--moss)", width: `${pct}%`, transition: "width 0.4s ease" }}/>
      </div>

      {/* Prompt header strip */}
      <div style={{
        padding: "12px 18px",
        background: isChallenge ? "oklch(0.94 0.05 80)" : "var(--washi-2)",
        borderBottom: "1px solid var(--hairline)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: 999,
            background: isChallenge ? "oklch(0.78 0.1 85)" : "var(--moss)",
            color: "var(--washi)", display: "flex", alignItems: "center",
            justifyContent: "center", fontFamily: "var(--font-mono)",
            fontSize: 11, fontWeight: 700,
          }}>{promptIdx + 1}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isChallenge && (
              <div className="mono" style={{ fontSize: 9.5, color: "oklch(0.5 0.1 65)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>
                Challenge
              </div>
            )}
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{currentPrompt.prompt}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, fontStyle: "italic" }}>{currentPrompt.promptEn}</div>

            {currentPrompt.model && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowModel(v => !v)} style={{
                  padding: 0, background: "none", border: "none", cursor: "pointer",
                  color: "var(--moss)", fontFamily: "var(--font-mono)",
                  fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
                }}>{showModel ? "Hide example" : "Show example"}</button>
                {showModel && (
                  <div className="jp-serif" style={{
                    marginTop: 4, padding: "7px 10px", background: "var(--washi)",
                    borderRadius: 6, border: "1px solid var(--hairline)",
                    fontSize: 15, fontWeight: 500, color: "var(--ink)",
                    animation: "glossFadeIn 0.2s ease",
                  }}>{currentPrompt.model}</div>
                )}
              </div>
            )}
          </div>

          {/* Prompt progress dots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, paddingTop: 4 }}>
            {allPrompts.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: 999,
                background: i < promptIdx ? "var(--moss)"
                  : i === promptIdx ? "var(--ink)"
                  : "var(--hairline)",
                transition: "background 0.2s",
              }}/>
            ))}
          </div>
        </div>

        {/* Inline target chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {currentPrompt.targets.map((t, i) => {
            const cnt = countMatch(t.matches);
            const met = cnt >= t.count;
            return (
              <div key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 999,
                background: met ? "var(--moss)" : "var(--washi)",
                border: `1px solid ${met ? "var(--moss)" : "var(--hairline)"}`,
                transition: "all 0.2s",
              }}>
                {met && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>}
                <span className="jp-serif" style={{ fontSize: 14, fontWeight: 600, color: met ? "var(--washi)" : "var(--ink)" }}>{t.surface}</span>
                <span className="mono" style={{ fontSize: 9, color: met ? "oklch(0.97 0.008 80 / 0.7)" : "var(--ink-3)", letterSpacing: "0.06em" }}>{Math.min(cnt, t.count)}/{t.count}</span>
              </div>
            );
          })}
        </div>

        {/* Advance button (when all targets met + not last) */}
        {targetsMet && !isLastPrompt && (
          <button onClick={advance} style={{
            width: "100%", marginTop: 10, padding: "10px", borderRadius: 999,
            background: "var(--moss)", border: "none", color: "var(--washi)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            animation: "glossFadeIn 0.25s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            次のプロンプト · Next prompt
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        )}
        {allComplete && (
          <div style={{
            width: "100%", marginTop: 10, padding: "10px", borderRadius: "var(--r-md)",
            background: "oklch(0.9 0.06 140)", border: "1px solid oklch(0.7 0.1 140)",
            fontSize: 13, color: "oklch(0.3 0.1 140)", fontWeight: 600, textAlign: "center",
            animation: "glossFadeIn 0.25s ease",
          }}>
            完成！All prompts complete.
          </div>
        )}
      </div>

      {/* Textarea */}
      <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleText}
          placeholder="ここに日本語を書いてください… (Write Japanese here)"
          style={{
            flex: 1, resize: "none", padding: "14px", borderRadius: "var(--r-md)",
            border: "2px solid var(--hairline)", background: "var(--washi)",
            fontFamily: "var(--font-jp)", fontSize: 18, lineHeight: 1.8,
            color: "var(--ink)", outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = "var(--moss)"}
          onBlur={e => e.target.style.borderColor = "var(--hairline)"}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{text.length} chars · {totalMet}/{totalTargets} targets</div>
          <button onClick={() => setShowBank(v => !v)} style={{
            padding: "6px 14px", borderRadius: 999, cursor: "pointer",
            background: showBank ? "var(--ink)" : "var(--washi)",
            color: showBank ? "var(--washi)" : "var(--ink-2)",
            border: showBank ? "none" : "1px solid var(--hairline)",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 600,
          }}>词 Word bank</button>
        </div>
      </div>

      {/* Word bank drawer */}
      {showBank && <ComposeWordBank prompt={currentPrompt} particles={data.particles} conjugations={data.conjugations} onInsert={insertWord} />}

      {/* Score overlay */}
      {showScore && <ComposeScore text={text} data={data} allPrompts={allPrompts} promptIdx={promptIdx} countMatch={countMatch} onClose={() => setShowScore(false)} />}
    </div>
  );
}

// ─── Word Bank drawer ─────────────────────────────────────────
function ComposeWordBank({ prompt, particles, conjugations, onInsert }) {
  const [tab, setTab] = React.useState("vocab");
  const tabs = [
    { key: "vocab", label: "Words" },
    { key: "particles", label: "Particles" },
    { key: "conj", label: "Patterns" },
  ];

  return (
    <div style={{
      flexShrink: 0, background: "var(--washi)",
      borderTop: "1px solid var(--hairline)",
      maxHeight: 220, display: "flex", flexDirection: "column",
    }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--hairline)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px 4px", border: "none",
            background: tab === t.key ? "var(--washi-2)" : "var(--washi)",
            borderBottom: tab === t.key ? "2px solid var(--moss)" : "2px solid transparent",
            color: tab === t.key ? "var(--ink)" : "var(--ink-3)",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
            transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {tab === "vocab" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {(prompt.vocabPool || []).map((v, i) => (
              <button key={i} onClick={() => onInsert(v.surface)} style={{
                padding: "6px 10px", borderRadius: 8,
                background: "var(--washi-2)", border: "1px solid var(--hairline)",
                cursor: "pointer", display: "flex", gap: 5, alignItems: "center",
                transition: "all 0.12s",
              }}>
                <span className="jp-serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{v.surface}</span>
                <span className="jp-sans" style={{ fontSize: 10, color: "var(--ink-3)" }}>{v.reading}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "particles" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {(particles || []).map((p, i) => (
              <button key={i} onClick={() => onInsert(p.particle)} style={{
                padding: "6px 10px", borderRadius: 8,
                background: "var(--washi-2)", border: "1px solid var(--hairline)",
                cursor: "pointer", display: "flex", gap: 6, alignItems: "center",
              }}>
                <span className="jp-serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{p.particle}</span>
                <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" }}>{p.role}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "conj" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(conjugations || []).map((c, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  <span className="jp-serif">{c.pattern}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 8 }}>{c.meaning}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(c.examples || []).map((ex, j) => (
                    <button key={j} onClick={() => onInsert(ex)} style={{
                      padding: "5px 10px", borderRadius: 7,
                      background: "var(--washi-2)", border: "1px solid var(--hairline)",
                      cursor: "pointer", fontFamily: "var(--font-jp)", fontSize: 14, fontWeight: 500, color: "var(--ink)",
                    }}>{ex}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Score overlay ────────────────────────────────────────────
function ComposeScore({ text, data, allPrompts, promptIdx, countMatch, onClose }) {
  const completed = allPrompts.filter((p, i) => {
    if (i < promptIdx) return true;
    if (i === promptIdx) return p.targets.every(t => countMatch(t.matches) >= t.count);
    return false;
  }).length;
  const total = allPrompts.length;
  const completePct = Math.round((completed / total) * 100);

  const wordCount = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  // All target words used
  const allTargets = allPrompts.flatMap(p => p.targets);
  const targetsHit = allTargets.filter(t => countMatch(t.matches) >= t.count).length;

  // Simple scoring
  const promptScore  = Math.round((completed / total) * 40);
  const targetScore  = Math.round((targetsHit / Math.max(allTargets.length, 1)) * 30);
  const lengthScore  = Math.min(30, Math.round((charCount / 100) * 30));
  const totalScore   = promptScore + targetScore + lengthScore;
  const grade = totalScore >= 90 ? "S" : totalScore >= 75 ? "A" : totalScore >= 60 ? "B" : totalScore >= 40 ? "C" : "D";
  const gradeColor = totalScore >= 75 ? "var(--moss)" : totalScore >= 60 ? "var(--gold)" : "var(--vermilion)";

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
      animation: "glossFadeIn 0.2s ease",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--washi)", borderRadius: "var(--r-xl)",
        padding: "28px 24px", width: "88%", maxWidth: 360,
        animation: "hanabiPop 0.35s ease",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>採点 · Score</div>
          <div style={{
            fontSize: 60, fontWeight: 700, lineHeight: 1,
            color: gradeColor, letterSpacing: "-0.04em",
          }}>{totalScore}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>/ 100 · Grade {grade}</div>
        </div>

        {/* Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 18 }}>
          {[
            { label: "Prompts completed", score: promptScore, max: 40, detail: `${completed}/${total}` },
            { label: "Target words used", score: targetScore, max: 30, detail: `${targetsHit}/${allTargets.length}` },
            { label: "Writing volume",    score: lengthScore,  max: 30, detail: `${charCount} chars` },
          ].map((row, i) => (
            <div key={i} style={{ padding: "10px 14px", background: i % 2 === 0 ? "var(--washi-2)" : "var(--washi)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{row.label}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{row.detail}</div>
                <div style={{ height: 3, borderRadius: 999, background: "var(--hairline)", marginTop: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(row.score / row.max) * 100}%`, background: "var(--moss)", borderRadius: 999, transition: "width 0.5s ease" }}/>
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 20, fontWeight: 700, color: "var(--moss)", flexShrink: 0 }}>{row.score}</div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          width: "100%", padding: "12px", borderRadius: 999,
          background: "var(--ink)", border: "none", color: "var(--washi)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>Close</button>
      </div>
    </div>
  );
}

Object.assign(window, { ComposeView, ComposeWordBank, ComposeScore });
