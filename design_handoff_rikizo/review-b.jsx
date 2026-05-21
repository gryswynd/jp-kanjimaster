// Review module — Part B: Quiz flow (MCQ, scramble, reading, score screen).

function ReviewQuiz({ id, onBack }) {
  const review = window.RikizoReviews.activeReview;
  const questions = review.questions;

  const [qIdx, setQIdx]     = React.useState(-1); // -1 = intro
  const [answers, setAnswers] = React.useState({}); // idx → { correct, answer }
  const [done, setDone]     = React.useState(false);
  const [picked, setPicked] = React.useState(null); // current question pick

  const q = qIdx >= 0 && qIdx < questions.length ? questions[qIdx] : null;

  const totalQ = questions.length;
  const score  = Object.values(answers).filter(a => a.correct).length;
  const pct    = done ? Math.round((score / totalQ) * 100) : Math.round((qIdx / totalQ) * 100);

  const advance = (correct, userAnswer) => {
    setAnswers(a => ({ ...a, [qIdx]: { correct, answer: userAnswer } }));
    setPicked(null);
    const next = qIdx + 1;
    if (next >= totalQ) {
      setTimeout(() => setDone(true), 600);
    } else {
      setTimeout(() => setQIdx(next), 500);
    }
  };

  const restart = () => {
    setQIdx(-1); setAnswers({}); setDone(false); setPicked(null);
  };

  // Intro screen
  if (qIdx === -1) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
        <div style={{ padding: "54px 20px 18px", background: "var(--ink)", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={reviewBackBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>REVIEW · {review.lessons}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--washi)", marginTop: 1 }}>{review.title}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center", gap: 20 }}>
          <div style={{
            fontFamily: "var(--font-jp-display)", fontSize: 120,
            color: "var(--washi-3)", lineHeight: 1,
          }}>習</div>

          <div>
            <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{review.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{review.focus}</div>
          </div>

          {/* Section breakdown */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
            {review.sections.map((s, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: "var(--r-md)",
                background: "var(--washi-2)", border: "1px solid var(--hairline)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.title}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{s.questions} Qs</div>
              </div>
            ))}
          </div>

          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {totalQ} questions total · ~{Math.ceil(totalQ * 0.8)} min
          </div>

          <button onClick={() => setQIdx(0)} style={{
            width: "100%", padding: "16px", borderRadius: 999,
            background: "var(--ink)", border: "none", color: "var(--washi)",
            fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            Begin review
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return <ReviewScore review={review} score={score} total={totalQ} answers={answers} onRetry={restart} onBack={onBack} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {/* Header */}
      <div style={{ padding: "54px 20px 14px", background: "var(--ink)", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={reviewBackBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>{q?.section}</div>
          <div className="mono" style={{ fontSize: 11, color: "oklch(0.97 0.008 80 / 0.5)", letterSpacing: "0.08em", marginTop: 1 }}>{qIdx + 1} / {totalQ}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--moss)", lineHeight: 1 }}>{score}</div>
          <div className="mono" style={{ fontSize: 8.5, color: "oklch(0.97 0.008 80 / 0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>correct</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ height: 3, background: "var(--hairline)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--vermilion)", width: `${(qIdx / totalQ) * 100}%`, transition: "width 0.3s ease" }}/>
      </div>

      {/* Question body */}
      <div key={qIdx} className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "20px 18px 32px", animation: "glossFadeIn 0.25s ease" }}>
        {q?.type === "mcq"      && <ReviewMCQ      q={q} onAnswer={advance} />}
        {q?.type === "scramble" && <ReviewScramble q={q} onAnswer={advance} />}
        {q?.type === "reading"  && <ReviewReading  q={q} prevPassage={qIdx > 0 && questions[qIdx-1]?.type === "reading" ? questions[qIdx-1].passage : null} onAnswer={advance} />}
      </div>
    </div>
  );
}

// ── MCQ question ──────────────────────────────────────────────
function ReviewMCQ({ q, onAnswer }) {
  const [picked, setPicked] = React.useState(null);

  const select = (c) => {
    if (picked) return;
    setPicked(c);
    const correct = c === q.answer;
    setTimeout(() => onAnswer(correct, c), 900);
  };

  const answered = picked !== null;

  return (
    <div>
      {/* Passage / conversation */}
      {q.passage && (
        <div style={{
          marginBottom: 18, padding: "14px 16px",
          background: "var(--washi-2)", border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
        }}>
          {q.passage.map((line, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              marginBottom: i < q.passage.length - 1 ? 10 : 0,
            }}>
              <div className="mono" style={{
                fontSize: 9.5, color: "var(--vermilion)", fontWeight: 700,
                letterSpacing: "0.06em", width: 42, flexShrink: 0, paddingTop: 5,
              }}>{line.spk}</div>
              <div className="jp-serif" style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 500, color: "var(--ink)" }}>{line.jp}</div>
            </div>
          ))}
        </div>
      )}

      {/* Question */}
      <div style={{ marginBottom: 18 }}>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Question {q.num}</div>
        <div className="jp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{q.q}</div>
        {q.qEn && <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 3 }}>{q.qEn}</div>}
      </div>

      {/* Choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.choices.map((c, i) => {
          const isSelected = picked === c;
          const isCorrect  = c === q.answer;
          let bg = "var(--washi)", border = "1px solid var(--hairline)", color = "var(--ink)";
          if (answered) {
            if (isCorrect)                    { bg = "oklch(0.91 0.06 140)"; border = "none"; }
            else if (isSelected && !isCorrect){ bg = "oklch(0.91 0.06 30)";  border = "none"; }
          } else if (isSelected) {
            bg = "var(--ink)"; color = "var(--washi)"; border = "none";
          }
          return (
            <button key={i} onClick={() => select(c)} style={{
              padding: "14px 16px", background: bg, border, color,
              borderRadius: "var(--r-md)", cursor: answered ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              transition: "all 0.15s",
            }}>
              <span className="mono" style={{
                fontSize: 10.5, fontWeight: 700, flexShrink: 0, width: 18,
                color: answered ? (isCorrect ? "oklch(0.4 0.1 140)" : isSelected ? "oklch(0.4 0.14 30)" : "var(--ink-3)") : (isSelected ? "var(--washi)" : "var(--ink-3)"),
              }}>{String.fromCharCode(65 + i)}</span>
              <span className="jp-serif" style={{ fontSize: 15, fontWeight: 500 }}>{c}</span>
              {answered && isCorrect && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.4 0.1 140)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M5 12l5 5L20 7"/></svg>
              )}
            </button>
          );
        })}
      </div>

      {answered && q.explain && (
        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: picked === q.answer ? "oklch(0.94 0.03 140)" : "oklch(0.94 0.03 30)",
          border: `1px solid ${picked === q.answer ? "oklch(0.75 0.08 140)" : "oklch(0.75 0.08 30)"}`,
          borderRadius: "var(--r-md)", animation: "glossFadeIn 0.2s ease",
        }}>
          <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: picked === q.answer ? "oklch(0.4 0.1 140)" : "oklch(0.4 0.14 30)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
            {picked === q.answer ? "正解 · Correct" : "残念 · Incorrect"}
          </div>
          <div className="jp-serif" style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, fontFamily: "var(--font-ui)" }}>{q.explain}</div>
        </div>
      )}
    </div>
  );
}

// ── Reading question ──────────────────────────────────────────
function ReviewReading({ q, prevPassage, onAnswer }) {
  const passage = q.passage || prevPassage;
  const [picked, setPicked] = React.useState(null);
  const answered = picked !== null;

  const select = (c) => {
    if (picked) return;
    setPicked(c);
    setTimeout(() => onAnswer(c === q.answer, c), 900);
  };

  return (
    <div>
      {passage && (
        <div style={{
          marginBottom: 18, padding: "16px 16px",
          background: "var(--washi-2)", border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)", borderLeft: "3px solid var(--vermilion)",
        }}>
          {passage.map((line, i) => (
            <div key={i} className="jp-serif" style={{ fontSize: 15, lineHeight: 1.8, color: "var(--ink)", marginBottom: i < passage.length - 1 ? 4 : 0 }}>{line}</div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Question {q.num}</div>
        <div className="jp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{q.q}</div>
        {q.qEn && <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 3 }}>{q.qEn}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.choices.map((c, i) => {
          const isSelected = picked === c, isCorrect = c === q.answer;
          let bg = "var(--washi)", border = "1px solid var(--hairline)", color = "var(--ink)";
          if (answered) {
            if (isCorrect) { bg = "oklch(0.91 0.06 140)"; border = "none"; }
            else if (isSelected) { bg = "oklch(0.91 0.06 30)"; border = "none"; }
          } else if (isSelected) { bg = "var(--ink)"; color = "var(--washi)"; border = "none"; }
          return (
            <button key={i} onClick={() => select(c)} style={{
              padding: "14px 16px", background: bg, border, color,
              borderRadius: "var(--r-md)", cursor: answered ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 12, textAlign: "left", transition: "all 0.15s",
            }}>
              <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, flexShrink: 0, width: 18, color: answered ? (isCorrect ? "oklch(0.4 0.1 140)" : isSelected ? "oklch(0.4 0.14 30)" : "var(--ink-3)") : (isSelected ? "var(--washi)" : "var(--ink-3)") }}>{String.fromCharCode(65 + i)}</span>
              <span className="jp-serif" style={{ fontSize: 15, fontWeight: 500 }}>{c}</span>
            </button>
          );
        })}
      </div>

      {answered && q.explain && (
        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: picked === q.answer ? "oklch(0.94 0.03 140)" : "oklch(0.94 0.03 30)",
          border: `1px solid ${picked === q.answer ? "oklch(0.75 0.08 140)" : "oklch(0.75 0.08 30)"}`,
          borderRadius: "var(--r-md)", animation: "glossFadeIn 0.2s ease",
        }}>
          <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: picked === q.answer ? "oklch(0.4 0.1 140)" : "oklch(0.4 0.14 30)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
            {picked === q.answer ? "正解 · Correct" : "残念 · Incorrect"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>{q.explain}</div>
        </div>
      )}
    </div>
  );
}

// ── Scramble question ─────────────────────────────────────────
function ReviewScramble({ q, onAnswer }) {
  const allChips = React.useMemo(() => {
    const all = [...q.segments, ...(q.distractors || [])];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, []);

  const [order, setOrder]     = React.useState([]);
  const [usedSet, setUsedSet] = React.useState(new Set());
  const [checked, setChecked] = React.useState(false);
  const [correct, setCorrect] = React.useState(null);

  const addChip = (word) => {
    if (usedSet.has(word)) return;
    setOrder(o => [...o, word]);
    setUsedSet(s => new Set([...s, word]));
  };
  const removeChip = (i) => {
    const word = order[i];
    setOrder(o => o.filter((_, j) => j !== i));
    setUsedSet(s => { const n = new Set(s); n.delete(word); return n; });
  };
  const clear = () => { setOrder([]); setUsedSet(new Set()); };

  const check = () => {
    const userAnswer = order.join("");
    const isCorrect  = userAnswer === q.answer.replace(/。/g, "").trim() ||
      userAnswer === q.answer;
    setChecked(true);
    setCorrect(isCorrect);
    setTimeout(() => onAnswer(isCorrect, userAnswer), 900);
  };

  const ready = order.length === q.segments.length;

  const chipColor = (word, i) => {
    if (!checked) return { bg: "var(--washi-2)", border: "1px solid var(--hairline)", color: "var(--ink)" };
    const segIdx = q.segments.indexOf(word);
    if (segIdx === i) return { bg: "oklch(0.9 0.06 140)", border: "none", color: "var(--ink)" };
    if (segIdx >= 0)  return { bg: "oklch(0.92 0.07 80)",  border: "none", color: "var(--ink)" };
    return             { bg: "oklch(0.9 0.06 30)",  border: "none", color: "var(--ink)" };
  };

  return (
    <div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Question {q.num}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{q.instruction}</div>
      {q.qEn && <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 16 }}>{q.qEn}</div>}

      {/* Answer box */}
      <div style={{
        minHeight: 60, padding: "12px 14px", marginBottom: 14,
        border: `2px ${checked ? "solid" : "dashed"} ${checked ? (correct ? "oklch(0.65 0.1 140)" : "oklch(0.6 0.16 30)") : "var(--hairline)"}`,
        background: checked ? (correct ? "oklch(0.94 0.04 140)" : "oklch(0.94 0.04 30)") : "var(--washi-2)",
        borderRadius: "var(--r-md)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        transition: "all 0.2s",
      }}>
        {order.length === 0 ? (
          <span style={{ color: "var(--ink-3)", fontSize: 13, fontStyle: "italic" }}>Tap words below…</span>
        ) : (
          order.map((word, i) => {
            const { bg, border, color } = chipColor(word, i);
            return (
              <button key={i} onClick={() => !checked && removeChip(i)} style={{
                padding: "8px 12px", background: bg, border, color,
                borderRadius: 8, cursor: checked ? "default" : "pointer",
                fontFamily: "var(--font-jp-display)", fontSize: 15, fontWeight: 500,
                transition: "all 0.15s",
              }}>{word}</button>
            );
          })
        )}
      </div>

      {/* Chip pool */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {allChips.map((word, i) => (
          <button key={i} onClick={() => !checked && addChip(word)} style={{
            padding: "10px 14px", background: usedSet.has(word) ? "var(--washi-3)" : "var(--washi)",
            border: "1px solid var(--hairline)", opacity: usedSet.has(word) ? 0.35 : 1,
            borderRadius: 8, cursor: (checked || usedSet.has(word)) ? "default" : "pointer",
            fontFamily: "var(--font-jp-display)", fontSize: 15, fontWeight: 500, color: "var(--ink)",
            transition: "all 0.12s",
          }}>{word}</button>
        ))}
      </div>

      {!checked && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={clear} style={{
            padding: "12px 16px", borderRadius: 999, cursor: "pointer",
            background: "transparent", border: "1px solid var(--hairline)", color: "var(--ink-2)",
            fontSize: 13, fontWeight: 600,
          }}>Clear</button>
          <button onClick={check} disabled={!ready} style={{
            flex: 1, padding: "12px", borderRadius: 999,
            background: ready ? "var(--ink)" : "var(--hairline)",
            border: "none", color: ready ? "var(--washi)" : "var(--ink-3)",
            fontSize: 14, fontWeight: 700, cursor: ready ? "pointer" : "not-allowed",
          }}>Check ✓</button>
        </div>
      )}

      {checked && (
        <div style={{
          padding: "12px 14px",
          background: correct ? "oklch(0.94 0.03 140)" : "oklch(0.94 0.03 30)",
          border: `1px solid ${correct ? "oklch(0.75 0.08 140)" : "oklch(0.75 0.08 30)"}`,
          borderRadius: "var(--r-md)", animation: "glossFadeIn 0.2s ease",
        }}>
          <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: correct ? "oklch(0.4 0.1 140)" : "oklch(0.4 0.14 30)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
            {correct ? "正解 · Correct" : "残念 · Incorrect"}
          </div>
          {!correct && (
            <div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Correct order</div>
              <div className="jp-serif" style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>{q.answer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Score screen ──────────────────────────────────────────────
function ReviewScore({ review, score, total, answers, onRetry, onBack }) {
  const pct   = Math.round((score / total) * 100);
  const grade = pct >= 95 ? "S" : pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : "D";
  const gradeColor = pct >= 90 ? "oklch(0.7 0.12 140)" : pct >= 75 ? "oklch(0.6 0.12 250)" : pct >= 60 ? "var(--gold)" : "var(--vermilion)";
  const pass  = pct >= 60;

  const bySection = {};
  review.questions.forEach((q, i) => {
    if (!bySection[q.section]) bySection[q.section] = { correct: 0, total: 0 };
    bySection[q.section].total++;
    if (answers[i]?.correct) bySection[q.section].correct++;
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--ink)" }}>
      <div style={{ padding: "54px 20px 16px", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>RESULTS · {review.id}</div>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "0 22px 40px", color: "var(--washi)" }}>
        {/* Score hero */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Hanko size={64} rotate={-8}>習</Hanko>
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: gradeColor }}>{pct}%</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: gradeColor, marginTop: 2 }}>Grade {grade}</div>
          <div className="mono" style={{ fontSize: 11, color: "oklch(0.97 0.008 80 / 0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>{score} / {total} correct</div>
        </div>

        {/* Section breakdown */}
        <div style={{ background: "oklch(0.97 0.008 80 / 0.06)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 22 }}>
          {Object.entries(bySection).map(([section, s], i) => {
            const spct = Math.round((s.correct / s.total) * 100);
            return (
              <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.97 0.008 80 / 0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--washi)", marginBottom: 6 }}>{section}</div>
                  <div style={{ height: 3, borderRadius: 999, background: "oklch(0.97 0.008 80 / 0.15)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${spct}%`, background: spct >= 75 ? "oklch(0.7 0.12 140)" : spct >= 60 ? "var(--gold)" : "var(--vermilion)", borderRadius: 999, transition: "width 0.5s ease" }}/>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: spct >= 75 ? "oklch(0.7 0.12 140)" : "var(--vermilion)", fontWeight: 700 }}>{s.correct}/{s.total}</div>
              </div>
            );
          })}
        </div>

        {/* Message */}
        <div style={{
          padding: "14px 16px", borderRadius: "var(--r-md)", marginBottom: 20,
          background: pass ? "oklch(0.15 0.04 140)" : "oklch(0.15 0.04 30)",
          border: `1px solid ${pass ? "oklch(0.4 0.08 140)" : "oklch(0.4 0.1 30)"}`,
          fontSize: 13, color: "var(--washi)", lineHeight: 1.55,
        }}>
          {pass
            ? "Congratulations! Score ≥60% — this review is passed. Head to the Dojo to drill your flagged terms."
            : "Good effort. Review the flagged terms in the Dojo and try again — aim for 60% to pass."}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={onRetry} style={{ width: "100%", padding: "14px", borderRadius: 999, background: "var(--vermilion)", border: "none", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Try again</button>
          <button onClick={onBack}  style={{ width: "100%", padding: "14px", borderRadius: 999, background: "transparent", border: "1px solid oklch(0.97 0.008 80 / 0.2)", color: "var(--washi)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Back to reviews</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReviewQuiz, ReviewScore });
