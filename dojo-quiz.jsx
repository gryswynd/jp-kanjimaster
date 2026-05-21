// ─── MCQ Quiz Flow ────────────────────────────────────────────
function DojoQuiz({ mode, onExit }) {
  const allCards = window.RikizoDojo.kanjiFlashcards;
  const [cards] = React.useState(() => shuffle([...allCards]));
  const [idx, setIdx] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [streak, setStreak] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [done, setDone] = React.useState(false);

  const card = cards[idx];
  const isReverse = mode === "quiz-meaning-r";
  const isReading = mode === "quiz-reading";

  // Build choices: correct + 3 random wrong
  const choices = React.useMemo(() => {
    if (!card) return [];
    const pool = allCards.filter(c => c.kanji !== card.kanji);
    const wrong = shuffle(pool).slice(0, 3);
    const correct = card;
    return shuffle([correct, ...wrong]);
  }, [idx]);

  const getQuestion = (c) => {
    if (isReverse) return c.meaning;
    if (isReading) return c.kanji;
    return c.kanji;
  };
  const getAnswer = (c) => {
    if (isReverse) return c.kanji;
    if (isReading) return c.reading;
    return c.meaning;
  };

  const pick = (c) => {
    if (picked != null) return;
    setPicked(c);
    const correct = c.kanji === card.kanji;
    if (correct) { setStreak(s => s + 1); setScore(s => s + 1); }
    else setStreak(0);
  };

  const next = () => {
    if (idx + 1 >= cards.length) { setDone(true); return; }
    setIdx(i => i + 1);
    setPicked(null);
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--washi)",
    }}>
      {/* Header */}
      <div style={{
        padding: "54px 20px 14px", background: "var(--ink)", color: "var(--washi)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onExit} style={{
          width: 32, height: 32, borderRadius: 999,
          border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--washi)", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>
            {isReverse ? "MEANING → KANJI" : isReading ? "KANJI → READING" : "KANJI → MEANING"}
          </div>
          <div style={{ fontSize: 13, color: "var(--washi)", marginTop: 2, fontWeight: 600 }}>N5.9 · Quiz</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: streak > 0 ? "oklch(0.75 0.12 85)" : "oklch(0.97 0.008 80 / 0.4)", lineHeight: 1 }}>{streak}</div>
          <div className="mono" style={{ fontSize: 8.5, color: "oklch(0.97 0.008 80 / 0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>streak</div>
        </div>
      </div>

      <div style={{ height: 3, background: "var(--hairline)" }}>
        <div style={{
          height: "100%", background: "var(--vermilion)", borderRadius: 999,
          width: `${(idx / cards.length) * 100}%`, transition: "width 0.3s ease",
        }}/>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {done ? (
          <QuizDoneScreen score={score} total={cards.length} onRestart={() => { setIdx(0); setPicked(null); setStreak(0); setScore(0); setDone(false); }} onExit={onExit} />
        ) : (
          <>
            <div className="mono" style={{
              fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em",
              textTransform: "uppercase", marginBottom: 6,
            }}>{idx + 1} / {cards.length}</div>

            {/* Question */}
            <div style={{
              padding: "28px 20px",
              background: "var(--washi-2)", border: "1px solid var(--hairline)",
              borderRadius: "var(--r-lg)", textAlign: "center", marginBottom: 20,
            }}>
              {isReverse ? (
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{card.meaning}</div>
              ) : (
                <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 80, fontWeight: 500, lineHeight: 1, color: "var(--ink)" }}>{card.kanji}</div>
              )}
              <div className="mono" style={{
                fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em",
                textTransform: "uppercase", marginTop: 10,
              }}>
                {isReverse ? "Which kanji?" : isReading ? "What is the reading?" : "What does this mean?"}
              </div>
            </div>

            {/* Choices */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {choices.map((c, i) => {
                const isSelected = picked?.kanji === c.kanji;
                const isCorrect  = c.kanji === card.kanji;
                let bg = "var(--washi)", border = "1px solid var(--hairline)", color = "var(--ink)";
                if (picked) {
                  if (isCorrect) { bg = "oklch(0.90 0.06 140)"; border = "none"; }
                  else if (isSelected) { bg = "oklch(0.90 0.06 30)"; border = "none"; }
                } else if (isSelected) {
                  bg = "var(--ink)"; color = "var(--washi)"; border = "none";
                }
                return (
                  <button key={c.kanji} onClick={() => pick(c)} style={{
                    padding: "14px 16px", background: bg, border, color,
                    borderRadius: "var(--r-md)", cursor: picked ? "default" : "pointer",
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    transition: "all 0.12s",
                  }}>
                    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: picked ? (isCorrect ? "var(--moss)" : isSelected ? "var(--vermilion)" : "var(--ink-3)") : "var(--ink-3)", width: 18, flexShrink: 0 }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {isReverse ? (
                      <span style={{ fontFamily: "var(--font-jp-display)", fontSize: 24, fontWeight: 500 }}>{c.kanji}</span>
                    ) : isReading ? (
                      <span className="jp-sans" style={{ fontSize: 18, fontWeight: 500 }}>{c.reading}</span>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{c.meaning}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {picked && (
              <button onClick={next} style={{
                width: "100%", marginTop: 16, padding: "14px", borderRadius: 999,
                background: "var(--ink)", border: "none", color: "var(--washi)",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                animation: "glossFadeIn 0.2s ease",
              }}>
                {idx + 1 >= cards.length ? "See results →" : "Next →"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuizDoneScreen({ score, total, onRestart, onExit }) {
  const pct = Math.round((score / total) * 100);
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <Hanko size={64} rotate={-8}>完</Hanko>
      </div>
      <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600 }}>{pct}%</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2, marginBottom: 24 }}>{score} / {total} correct</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onRestart} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "var(--ink)", border: "none", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Try again</button>
        <button onClick={onExit} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "transparent", border: "1px solid var(--hairline)", color: "var(--ink-2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back to Dojo</button>
      </div>
    </div>
  );
}

// ─── Stubs for other modes ────────────────────────────────────
function DojoStub({ mode, onExit }) {
  const stubs = {
    dojo:         { label: "Conjugation Dojo", kanji: "動", msg: "Produce verb conjugations under pressure." },
    scramble:     { label: "Scramble",          kanji: "文", msg: "Rearrange shuffled word chips into correct sentences." },
    "link-sorted":{ label: "Link Up: Sorted",   kanji: "組", msg: "Sort vocabulary into semantic categories." },
    "link-hidden":{ label: "Link Up: Hidden",   kanji: "謎", msg: "Find the hidden groups — NYT Connections style, 4 lives." },
    "flash-vocab":{ label: "Vocab Flashcards",  kanji: "語", msg: "Flip through vocab with reading and meaning." },
    "quiz-vocab": { label: "Vocab Quiz",         kanji: "語", msg: "Choose the correct English meaning for each word." },
    "quiz-reading":{ label: "Kanji → Reading",  kanji: "字", msg: "Select the correct reading for each kanji." },
    "flag-review":{ label: "Flagged Review",    kanji: "旗", msg: "Revisit items you flagged for more study." },
  };
  const s = stubs[mode] || { label: mode, kanji: "？", msg: "Coming soon." };
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 30px", textAlign: "center",
      background: "var(--washi)", gap: 12,
    }}>
      <div style={{
        fontFamily: "var(--font-jp-display)", fontSize: 100,
        color: "var(--washi-3)", lineHeight: 1, marginBottom: 6,
      }}>{s.kanji}</div>
      <MetaLabel color="var(--vermilion)">Coming soon</MetaLabel>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, maxWidth: 260 }}>{s.msg}</div>
      <button onClick={onExit} style={{
        marginTop: 20, padding: "12px 28px", borderRadius: 999,
        background: "var(--ink)", border: "none", color: "var(--washi)",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}>← Back to Dojo</button>
    </div>
  );
}

// ─── Lesson Picker Panel ──────────────────────────────────────
function LessonPickerPanel({ onClose }) {
  const [active, setActive] = React.useState(new Set(["N5.9"]));
  const lessons = window.RikizoDojo.lessons;

  const toggle = (id) => setActive(a => {
    const n = new Set(a);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      display: "flex", flexDirection: "column",
    }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.35)" }} />
      <div style={{
        background: "var(--washi)", borderRadius: "22px 22px 0 0",
        padding: "16px 20px 40px", maxHeight: "70%", overflowY: "auto",
      }} className="noscroll">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
        }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 18, fontWeight: 600 }}>Select Lessons</div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 999,
            border: "1px solid var(--hairline)", background: "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink-2)",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
          </button>
        </div>
        {lessons.map(l => (
          <div key={l.id} onClick={() => toggle(l.id)} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 0", borderBottom: "1px solid var(--hairline-2)",
            cursor: "pointer",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: active.has(l.id) ? "var(--ink)" : "var(--washi-2)",
              border: active.has(l.id) ? "none" : "1px solid var(--hairline)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}>
              {active.has(l.id) && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{l.id} · {l.title}</div>
              <div className="jp-sans" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                {l.kanji.slice(0,5).join(" · ")} ···
              </div>
            </div>
            <div className="mono" style={{
              fontSize: 9.5, color: l.status === "current" ? "var(--vermilion)" : l.status === "new" ? "var(--moss)" : "var(--ink-3)",
              textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
            }}>{l.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Object.assign(window, { DojoQuiz, DojoStub, LessonPickerPanel, shuffle });
