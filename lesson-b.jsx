// ═══════════════════════════════════════════════════════════
// PANEL 5.5 — READING (paired passages + comprehension)
// ═══════════════════════════════════════════════════════════
function ReadingPanel({ lesson }) {
  const readings = lesson.readings || [];
  const [idx, setIdx] = React.useState(0);
  const r = readings[idx];
  const [revealed, setRevealed] = React.useState({});
  const [showAns, setShowAns] = React.useState({});

  // reset per-passage state on swap
  React.useEffect(() => { setRevealed({}); setShowAns({}); }, [idx]);

  if (!r) return null;

  const allRevealed = r.passage.every((_, i) => revealed[i]);
  const revealAll = () => {
    const next = {};
    r.passage.forEach((_, i) => { next[i] = true; });
    setRevealed(next);
  };

  return (
    <div style={{ padding: "24px 0 32px" }}>
      <div style={{ padding: "0 22px" }}>
        <MetaLabel>Reading · {idx + 1} of {readings.length}</MetaLabel>

        {/* passage switcher */}
        {readings.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 6 }}>
            {readings.map((rr, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{
                flex: 1, padding: "7px 10px", borderRadius: 6,
                background: i === idx ? "var(--ink)" : "var(--washi)",
                color: i === idx ? "var(--washi)" : "var(--ink-2)",
                border: i === idx ? "1px solid var(--ink)" : "1px solid var(--hairline)",
                fontFamily: "var(--font-mono)", fontSize: 10,
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontWeight: 600, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ opacity: 0.7 }}>{rr.tag}</div>
                <div className="jp-sans" style={{
                  fontSize: 11, letterSpacing: "0.02em", marginTop: 2,
                  textTransform: "none", fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{rr.title}</div>
              </button>
            ))}
          </div>
        )}

        <h2 style={{
          fontFamily: "var(--font-jp-display)", fontSize: 24, fontWeight: 600,
          letterSpacing: "-0.02em", margin: "10px 0 2px", lineHeight: 1.25,
        }}>{r.title}</h2>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
          {r.titleEn}
        </div>

        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 10,
          fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          <span>Tap a line to translate</span>
          <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <button onClick={revealAll} disabled={allRevealed} style={{
            padding: "4px 10px", borderRadius: 999,
            background: "transparent",
            border: "1px solid var(--hairline)",
            color: allRevealed ? "var(--ink-3)" : "var(--vermilion)",
            fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 600,
            cursor: allRevealed ? "default" : "pointer",
            opacity: allRevealed ? 0.5 : 1,
          }}>Reveal all</button>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Passage — washi sheet with hanko-style seal */}
      <div style={{ padding: "0 22px" }}>
        <div style={{
          position: "relative",
          background: "var(--washi)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          padding: "22px 22px 20px",
          overflow: "hidden",
        }}>
          {/* edge rule for paper feel */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "var(--vermilion)",
          }} />

          {/* hanko seal */}
          <div style={{
            position: "absolute", right: 14, top: 14,
            display: "flex", justifyContent: "center",
          }}>
            <Hanko size={40} rotate={-8}>読</Hanko>
          </div>

          <div className="mono" style={{
            fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.16em",
            textTransform: "uppercase", fontWeight: 600, marginBottom: 12,
            paddingLeft: 6,
          }}>Passage · {String(idx + 1).padStart(2, "0")}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 6 }}>
            {r.passage.map((line, i) => {
              const on = revealed[i];
              return (
                <button key={i} onClick={() => setRevealed(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{
                    textAlign: "left", padding: "10px 6px",
                    background: "transparent", border: "none",
                    borderBottom: i < r.passage.length - 1 ? "1px dashed var(--hairline-2)" : "none",
                    cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                  <div className="mono" style={{
                    fontSize: 10, color: on ? "var(--vermilion)" : "var(--ink-3)",
                    letterSpacing: "0.1em", fontWeight: 600,
                    width: 18, flexShrink: 0, paddingTop: 6,
                  }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="jp-serif" style={{
                      fontSize: 18, lineHeight: 1.55, fontWeight: 500,
                      color: "var(--ink)",
                    }}>{line.jp}</div>
                    {on && (
                      <div style={{
                        fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)",
                        marginTop: 4, fontStyle: "italic",
                        animation: "lessonFadeIn 0.2s ease",
                      }}>{line.en}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comprehension */}
      <div style={{ padding: "26px 22px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
        }}>
          <div className="mono" style={{
            fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 600,
          }}>Comprehension</div>
          <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <div className="mono" style={{
            fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em",
          }}>{r.questions.length} 問</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.questions.map((q, i) => {
            const shown = showAns[i];
            return (
              <div key={i} style={{
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-md)",
                background: "var(--washi)",
                overflow: "hidden",
              }}>
                <div style={{ padding: "12px 14px 10px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div className="mono" style={{
                      fontSize: 10, color: "var(--vermilion)",
                      letterSpacing: "0.1em", fontWeight: 700,
                      width: 18, flexShrink: 0, paddingTop: 4,
                    }}>Q{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div className="jp-serif" style={{
                        fontSize: 15.5, lineHeight: 1.5, fontWeight: 500, color: "var(--ink)",
                      }}>{q.q}</div>
                      <div style={{
                        fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, fontStyle: "italic",
                      }}>{q.qEn}</div>
                    </div>
                  </div>

                  {!shown && (
                    <button onClick={() => setShowAns(prev => ({ ...prev, [i]: true }))} style={{
                      marginTop: 10, marginLeft: 28,
                      padding: "6px 12px", borderRadius: 999,
                      background: "transparent",
                      border: "1px solid var(--hairline)",
                      color: "var(--ink-2)", fontSize: 11,
                      fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
                      textTransform: "uppercase", fontWeight: 600,
                      cursor: "pointer",
                    }}>Show answer</button>
                  )}
                </div>

                {shown && (
                  <div style={{
                    padding: "10px 14px 12px 42px",
                    borderTop: "1px dashed var(--hairline-2)",
                    background: "var(--washi-2)",
                    animation: "lessonFadeIn 0.2s ease",
                  }}>
                    <div className="mono" style={{
                      fontSize: 9.5, color: "var(--moss)", letterSpacing: "0.14em",
                      textTransform: "uppercase", fontWeight: 700, marginBottom: 3,
                    }}>答え · Answer</div>
                    <div className="jp-serif" style={{
                      fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: "var(--ink)",
                    }}>{q.a}</div>
                    <div style={{
                      fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, fontStyle: "italic",
                    }}>{q.aEn}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 6 — DRILL (fill-the-slot)
// ═══════════════════════════════════════════════════════════
function DrillPanel({ lesson }) {
  const d = lesson.drill;
  const [picked, setPicked] = React.useState(null);
  const correct = picked === d.answer;

  return (
    <div style={{ padding: "24px 22px 32px" }}>
      <MetaLabel>Drill · 1 of 6</MetaLabel>
      <h2 style={{
        fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.02em", margin: "6px 0 6px",
      }}>Fill the slot</h2>
      <div style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.5 }}>
        Pick the position word that completes the sentence.
      </div>

      <div style={{ height: 28 }} />

      {/* Prompt card */}
      <div style={{
        padding: "26px 22px",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        background: "var(--washi)",
        position: "relative",
      }}>
        <div className="mono" style={{
          fontSize: 10, color: "var(--ink-3)",
          letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500,
          marginBottom: 14,
        }}>{d.en}</div>

        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 22,
          lineHeight: 1.6, fontWeight: 500, color: "var(--ink)",
          textAlign: "center",
        }}>
          {d.before}
          <span style={{
            display: "inline-block",
            minWidth: 68, padding: "4px 14px", margin: "0 6px",
            borderRadius: 8, verticalAlign: "middle",
            background: picked == null
              ? "var(--washi-3)"
              : correct
                ? "oklch(0.88 0.08 140)"
                : "oklch(0.88 0.08 30)",
            border: picked == null ? "2px dashed var(--ink-3)" : "none",
            color: picked == null ? "transparent" : "var(--ink)",
            fontSize: 22, fontWeight: 600,
            transition: "all 0.2s",
          }}>{picked || "_"}</span>
          {d.after}
        </div>
      </div>

      <div style={{ height: 22 }} />

      <MetaLabel>Choose one</MetaLabel>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10,
      }}>
        {d.choices.map(c => (
          <button key={c} onClick={() => setPicked(c)} style={{
            padding: "22px 16px", borderRadius: "var(--r-md)",
            background: picked === c
              ? (c === d.answer ? "var(--moss)" : "var(--vermilion)")
              : "var(--washi)",
            color: picked === c ? "var(--washi)" : "var(--ink)",
            border: picked === c ? "none" : "1px solid var(--hairline)",
            fontFamily: "var(--font-jp-display)",
            fontSize: 26, fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s",
            letterSpacing: "0.02em",
          }}>{c}</button>
        ))}
      </div>

      {picked && (
        <div style={{
          marginTop: 20, padding: "14px 16px",
          borderRadius: "var(--r-md)",
          background: correct ? "oklch(0.94 0.04 140)" : "oklch(0.94 0.04 30)",
          border: `1px solid ${correct ? "oklch(0.75 0.08 140)" : "oklch(0.75 0.08 30)"}`,
          animation: "lessonFadeIn 0.25s ease",
        }}>
          <div className="mono" style={{
            fontSize: 10, letterSpacing: "0.14em", fontWeight: 600,
            color: correct ? "oklch(0.4 0.1 140)" : "oklch(0.45 0.14 30)",
            textTransform: "uppercase", marginBottom: 4,
          }}>{correct ? "正解 · Correct" : "もう一度 · Try again"}</div>
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
            {d.explain}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 7 — CLOSE (summary + XP payout)
// ═══════════════════════════════════════════════════════════
function ClosePanel({ lesson }) {
  return (
    <div style={{ padding: "32px 22px 40px", textAlign: "center" }}>
      <div style={{
        fontFamily: "var(--font-jp-display)",
        fontSize: 60, lineHeight: 1, marginBottom: 14,
        fontWeight: 500,
      }}>おつかれさま</div>
      <div className="mono" style={{
        fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.16em",
        textTransform: "uppercase", fontWeight: 500,
      }}>You finished lesson 9</div>

      <div style={{ height: 28 }} />

      {/* Hanko seal */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <Hanko size={72} rotate={-6}>合</Hanko>
      </div>

      <div style={{
        padding: "20px 18px",
        border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)",
        background: "var(--washi)",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2,
        }}>
          <Stat label="XP earned" value="+180" color="var(--vermilion)" />
          <Stat label="Accuracy" value="92%" />
          <Stat label="Minutes" value="23" />
        </div>

        <div style={{ height: 18 }} />
        <div style={{ height: 1, background: "var(--hairline)" }} />
        <div style={{ height: 14 }} />

        <div style={{ textAlign: "left" }}>
          <MetaLabel>You learned</MetaLabel>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {lesson.kanji.map(k => (
              <div key={k} style={{
                width: 38, height: 38, background: "var(--ink)", color: "var(--washi)",
                borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 500,
              }}>{k}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 22, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6,
      }}>
        Up next: <strong style={{ color: "var(--ink)" }}>Dojo</strong> — drill today's kanji until they stick.
      </div>
    </div>
  );
}

Object.assign(window, { ReadingPanel, DrillPanel, ClosePanel });
