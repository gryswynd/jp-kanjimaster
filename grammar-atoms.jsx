// Grammar shared atoms — used by all 3 GrammarScreen variants.

// ── Audio play button (visual-only mock; calls SpeechSynthesis if available)
function AudioPlayBtn({ text, size = 26, color, bg = "var(--washi-2)" }) {
  const [playing, setPlaying] = React.useState(false);
  const play = (e) => {
    e.stopPropagation();
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 0.9;
      u.onend = () => setPlaying(false);
      setPlaying(true);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {
      setPlaying(true);
      setTimeout(() => setPlaying(false), 900);
    }
  };
  return (
    <button onClick={play} style={{
      width: size, height: size, borderRadius: 999,
      border: "1px solid var(--hairline)",
      background: bg, color: color || "var(--ink-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", padding: 0, flexShrink: 0,
      transition: "all 0.15s",
    }}>
      {playing ? (
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      ) : (
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      )}
    </button>
  );
}

// ── Bookmark button (writes to localStorage)
function BookmarkBtn({ id, size = 26 }) {
  const key = `rikizo_bookmark_${id}`;
  const [saved, setSaved] = React.useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const toggle = (e) => {
    e.stopPropagation();
    const n = !saved;
    setSaved(n);
    try {
      if (n) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {}
  };
  return (
    <button onClick={toggle} style={{
      width: size, height: size, borderRadius: 999,
      border: `1px solid ${saved ? "var(--vermilion)" : "var(--hairline)"}`,
      background: saved ? "var(--vermilion)" : "transparent",
      color: saved ? "var(--washi)" : "var(--ink-3)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", padding: 0, flexShrink: 0,
      transition: "all 0.15s",
    }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  );
}

// ── Role color helpers
function roleColor(role) {
  const r = window.RikizoGrammarRoles?.[role];
  return r?.color || "var(--ink-2)";
}
function roleBg(role) {
  const r = window.RikizoGrammarRoles?.[role];
  return r?.bg || "var(--washi-2)";
}

// ── Interactive word-chunk with gloss popover on tap
function GlossChunk({ text, role, gloss, size = 17, weight = 500, underline = true }) {
  const [open, setOpen] = React.useState(false);
  const color = roleColor(role);
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const t = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", close); };
  }, [open]);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="jp-serif"
        style={{
          fontSize: size, fontWeight: weight, color: "var(--ink)",
          letterSpacing: "0.01em",
          borderBottom: underline ? `2px solid ${color}` : "none",
          paddingBottom: 1,
          cursor: "pointer",
          background: open ? roleBg(role) : "transparent",
          borderRadius: 3,
          transition: "background 0.15s",
          padding: open ? "0 3px" : "0",
        }}
      >{text}</span>
      {open && (
        <span style={{
          position: "absolute", top: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 20,
          background: "var(--ink)", color: "var(--washi)",
          padding: "6px 10px", borderRadius: 6,
          fontSize: 11, fontFamily: "var(--font-ui)",
          whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          animation: "glossFadeIn 0.15s ease",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 8.5,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: color, marginRight: 6, opacity: 0.9,
          }}>{role}</span>
          {gloss}
          <span style={{
            position: "absolute", bottom: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: "5px solid var(--ink)",
          }}/>
        </span>
      )}
    </span>
  );
}

// ── Full example block: JP chunks + reveal English + breakdown
// variant: "compact" | "full"
function ExampleBlock({ ex, idx, variant = "full", showContext = true }) {
  const [revealed, setRevealed] = React.useState(false);
  const [showBreak, setShowBreak] = React.useState(false);
  const fullJp = ex.parts.map(p => p.text).join("");

  return (
    <div style={{
      padding: variant === "compact" ? "10px 12px" : "14px 14px",
      border: "1px solid var(--hairline)",
      background: "var(--washi)",
      borderRadius: variant === "compact" ? 8 : "var(--r-md)",
    }}>
      {showContext && ex.context && (
        <div className="mono" style={{
          fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 500, marginBottom: 8,
        }}>{ex.context}</div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AudioPlayBtn text={fullJp} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="jp-serif" style={{ lineHeight: 1.7, fontSize: 0 }}>
            {ex.parts.map((p, i) => (
              <React.Fragment key={i}>
                <GlossChunk text={p.text} role={p.role} gloss={p.gloss} size={variant === "compact" ? 16 : 17} />
                {i < ex.parts.length - 1 && <span style={{ display: "inline-block", width: 2 }} />}
              </React.Fragment>
            ))}
          </div>

          {revealed ? (
            <div style={{
              fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.5,
              fontStyle: "italic", animation: "glossFadeIn 0.2s ease",
            }}>"{ex.en}"</div>
          ) : (
            <button onClick={() => setRevealed(true)} style={{
              marginTop: 8, padding: 0,
              background: "transparent", border: "none",
              color: "var(--vermilion)", fontSize: 10.5,
              fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
            }}>Reveal English →</button>
          )}

          {revealed && ex.breakdown && (
            showBreak ? (
              <div style={{
                marginTop: 8, padding: "8px 10px", borderLeft: "2px solid var(--vermilion)",
                background: "var(--washi-2)",
                fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.5,
                animation: "glossFadeIn 0.2s ease",
              }}>{ex.breakdown}</div>
            ) : (
              <button onClick={() => setShowBreak(true)} style={{
                marginTop: 6, padding: 0,
                background: "transparent", border: "none",
                color: "var(--ink-3)", fontSize: 10.5,
                fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
                textTransform: "uppercase", fontWeight: 500, cursor: "pointer",
              }}>+ breakdown</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pattern chain: "VERB" → "て-FORM" → "+ います"
// style: "hero" (big banner), "compact" (small chips), "inline" (tight chain)
function PatternChain({ pattern, style = "hero", accent = "var(--vermilion)" }) {
  if (style === "compact") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      }}>
        {pattern.map((p, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: "inline-flex", flexDirection: "column", gap: 3,
              padding: "5px 9px", borderRadius: 6,
              background: roleBg(p.role),
              border: `1px solid ${roleColor(p.role)}`,
            }}>
              <span className="mono" style={{
                fontSize: 8.5, color: roleColor(p.role),
                letterSpacing: "0.12em", fontWeight: 600,
                lineHeight: 1, whiteSpace: "nowrap",
              }}>{p.label}</span>
              <span className="jp-serif" style={{
                fontSize: 13, color: "var(--ink)", fontWeight: 500,
                lineHeight: 1.2,
              }}>{p.text.replace(/^[→+] /, "")}</span>
            </div>
            {i < pattern.length - 1 && (
              <span style={{ color: "var(--ink-3)", fontSize: 12 }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // hero
  return (
    <div style={{
      padding: "18px 18px",
      background: "var(--ink)",
      borderRadius: "var(--r-md)",
      color: "var(--washi)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: accent,
      }}/>
      <div className="mono" style={{
        fontSize: 9.5, letterSpacing: "0.14em",
        color: accent, fontWeight: 600, marginBottom: 10,
        paddingLeft: 4,
      }}>Pattern formation</div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        paddingLeft: 4,
      }}>
        {pattern.map((p, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mono" style={{
                fontSize: 8.5, letterSpacing: "0.14em", fontWeight: 600,
                color: "oklch(0.97 0.008 80 / 0.55)",
              }}>{p.label}</span>
              <span className="jp-serif" style={{
                fontSize: 18, fontWeight: 500, color: "var(--washi)",
                letterSpacing: "0.01em",
              }}>{p.text.replace(/^[→+] /, "")}</span>
            </div>
            {i < pattern.length - 1 && (
              <span style={{ color: accent, fontSize: 18, opacity: 0.8, paddingTop: 12 }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── A/B comparison card (swipeable)
function ComparisonCard({ comparison }) {
  const [side, setSide] = React.useState(0);
  const item = comparison.items[side];
  const otherLabel = comparison.items[1 - side].label;
  const color = roleColor(item.role);

  return (
    <div style={{
      border: "1px solid var(--hairline)", background: "var(--washi)",
      borderRadius: "var(--r-md)", overflow: "hidden",
    }}>
      {/* Header toggle */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--hairline)",
      }}>
        {comparison.items.map((it, i) => (
          <button key={i} onClick={() => setSide(i)} style={{
            flex: 1, padding: "12px 14px",
            background: side === i ? "var(--washi-2)" : "var(--washi-3)",
            border: "none",
            borderBottom: side === i ? `3px solid ${roleColor(it.role)}` : "3px solid transparent",
            cursor: "pointer", textAlign: "left",
            color: side === i ? "var(--ink)" : "var(--ink-3)",
            transition: "all 0.15s",
          }}>
            <div className="jp-serif" style={{
              fontSize: 17, fontWeight: 600, letterSpacing: "0.01em",
            }}>{it.label}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>
              {it.sub}
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 16px" }}>
        <div className="mono" style={{
          fontSize: 9.5, letterSpacing: "0.14em", fontWeight: 600,
          color, marginBottom: 10, textTransform: "uppercase",
        }}>{item.label} · {item.sub}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {item.points.map((pt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div className="mono" style={{
                fontSize: 9, color, fontWeight: 700,
                width: 14, flexShrink: 0, paddingTop: 3,
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div className="jp-serif" style={{
                fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)",
                fontFamily: "var(--font-ui)",
              }} dangerouslySetInnerHTML={{ __html: pt }}/>
            </div>
          ))}
        </div>

        <ExampleBlock ex={item.example} variant="compact" showContext={false} />

        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--hairline)",
          fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Tap to compare with {otherLabel}</span>
          <button onClick={() => setSide(1 - side)} style={{
            border: "none", background: "transparent", color: "var(--vermilion)",
            fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
          }}>Swap →</button>
        </div>
      </div>

      {comparison.tip && (
        <div style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--hairline)",
          background: "var(--washi-2)",
          fontSize: 11.5, color: "var(--ink-2)", fontStyle: "italic", lineHeight: 1.5,
        }}>
          <strong style={{ color: "var(--vermilion)", fontStyle: "normal", marginRight: 6 }}>TIP</strong>
          {comparison.tip}
        </div>
      )}
    </div>
  );
}

// ── Conjugation table (compact)
function FormsTable({ table }) {
  return (
    <div style={{
      border: "1px solid var(--hairline)",
      background: "var(--washi)", borderRadius: "var(--r-md)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px 8px" }}>
        <div className="mono" style={{
          fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 500,
        }}>Forms · reference</div>
        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 16, fontWeight: 600,
          marginTop: 2, color: "var(--ink)",
        }}>{table.title}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{table.description}</div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr 1fr",
        rowGap: 0, columnGap: 0,
        fontSize: 12, lineHeight: 1.3,
      }}>
        <div className="mono" style={cellHead}>Form</div>
        <div className="jp-serif" style={cellHead}>行く</div>
        <div className="jp-serif" style={cellHead}>食べる</div>
        {table.rows.map((r, i) => (
          <React.Fragment key={i}>
            <div className="mono" style={{
              ...cellBody, color: "var(--vermilion)", fontWeight: 600,
              fontSize: 10, letterSpacing: "0.05em",
            }}>{r.label}</div>
            <div className="jp-serif" style={{ ...cellBody, color: "var(--ink)", fontWeight: 500 }}>{r.cells[0]}</div>
            <div className="jp-serif" style={{ ...cellBody, color: "var(--ink)", fontWeight: 500 }}>{r.cells[1]}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
const cellHead = {
  padding: "8px 12px",
  background: "var(--washi-2)",
  borderTop: "1px solid var(--hairline)",
  borderBottom: "1px solid var(--hairline)",
  fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--ink-3)", fontWeight: 600,
};
const cellBody = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--hairline-2)",
};

// ── Mini-quiz at end of section
function MiniQuiz({ quiz }) {
  const [answers, setAnswers] = React.useState({});
  const [done, setDone] = React.useState(false);

  const pick = (qi, ci) => {
    if (done) return;
    setAnswers(a => ({ ...a, [qi]: ci }));
  };

  const complete = Object.keys(answers).length === quiz.length;
  const score = quiz.filter((q, i) => answers[i] === q.answer).length;

  return (
    <div style={{
      padding: "18px 18px",
      background: "var(--washi-2)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r-lg)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
      }}>
        <div className="mono" style={{
          fontSize: 9.5, color: "var(--vermilion)", letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 700,
        }}>Checkpoint · 4 questions</div>
        {done && (
          <div style={{ flex: 1, textAlign: "right" }}>
            <span className="mono" style={{
              fontSize: 10, color: "var(--moss)", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>{score}/{quiz.length} correct</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {quiz.map((q, i) => (
          <div key={i}>
            <div style={{
              fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)",
              fontFamily: "var(--font-jp-display)", fontWeight: 500, marginBottom: 8,
            }}>
              <span className="mono" style={{
                fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.1em",
                marginRight: 8, fontFamily: "var(--font-mono)", fontWeight: 700,
              }}>Q{i + 1}</span>
              {q.q}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {q.choices.map((c, ci) => {
                const selected = answers[i] === ci;
                const correct = ci === q.answer;
                const showState = done && selected;
                const showCorrect = done && correct;
                let bg = "var(--washi)";
                let border = "1px solid var(--hairline)";
                let col = "var(--ink)";
                if (selected && !done) { bg = "var(--ink)"; col = "var(--washi)"; border = "none"; }
                if (showState && correct) { bg = "oklch(0.88 0.08 140)"; col = "var(--ink)"; border = "none"; }
                if (showState && !correct) { bg = "oklch(0.88 0.08 30)"; col = "var(--ink)"; border = "none"; }
                if (showCorrect && !selected) { border = "2px solid var(--moss)"; }
                return (
                  <button key={ci} onClick={() => pick(i, ci)} style={{
                    padding: "10px 10px", background: bg, border, borderRadius: 8,
                    color: col, fontFamily: "var(--font-jp-display)",
                    fontSize: 14, fontWeight: 500, cursor: done ? "default" : "pointer",
                    textAlign: "left", transition: "all 0.15s", letterSpacing: "0.01em",
                  }}>{c}</button>
                );
              })}
            </div>
            {done && q.explain && (
              <div style={{
                marginTop: 6, padding: "6px 10px",
                background: "var(--washi)", border: "1px dashed var(--hairline)",
                borderRadius: 6, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5,
              }}>{q.explain}</div>
            )}
          </div>
        ))}
      </div>

      {!done && (
        <button onClick={() => setDone(true)} disabled={!complete} style={{
          width: "100%", marginTop: 14,
          padding: "12px", borderRadius: 999,
          background: complete ? "var(--ink)" : "var(--hairline)",
          color: complete ? "var(--washi)" : "var(--ink-3)",
          border: "none", cursor: complete ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
        }}>
          {complete ? "Check answers" : `${Object.keys(answers).length}/${quiz.length} answered`}
        </button>
      )}
    </div>
  );
}

// ── Related lesson chip
function RelatedLessonChip({ lesson }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "5px 10px", borderRadius: 999,
      background: "var(--washi-2)", border: "1px solid var(--hairline)",
    }}>
      <span className="mono" style={{
        fontSize: 9, color: "var(--vermilion)", letterSpacing: "0.12em",
        textTransform: "uppercase", fontWeight: 700,
      }}>Unlocked by</span>
      <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>
        {lesson.id} · {lesson.title}
      </span>
    </div>
  );
}

Object.assign(window, {
  AudioPlayBtn, BookmarkBtn, GlossChunk,
  ExampleBlock, PatternChain, ComparisonCard,
  FormsTable, MiniQuiz, RelatedLessonChip,
  roleColor, roleBg,
});
