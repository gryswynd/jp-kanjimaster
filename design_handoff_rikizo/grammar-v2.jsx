// Grammar Variant 2 — "Cards" (redesigned)
// Deck structure:
//   [0] Intro
//   [1..5] Rule cards (ている, たいです, たがる, ましょう, でしょう)
//   [6] Comparison card (たい vs たがる)  ← standalone
//   [7] Forms table card  ← standalone reference
//   [8..15] MCQ drill cards (one per question)
//   [16] Score screen
//
// Header shows phase: TEACHING | PRACTICE | RESULTS
// No FormsTable or quiz embedded inside rule cards.

function GrammarVariantCards() {
  const g = window.RikizoGrammar;

  // Build the deck
  const deck = React.useMemo(() => buildDeck(g), [g]);
  const [idx, setIdx] = React.useState(0);
  const [drillAnswers, setDrillAnswers] = React.useState({}); // drillIdx → choiceIdx

  const card = deck[idx];
  const isFirst = idx === 0;
  const isLast  = idx === deck.length - 1;

  const canAdvance = () => {
    if (card.type === "drill") {
      return drillAnswers[card.drillIdx] != null;
    }
    return true;
  };

  const go = (i) => setIdx(Math.max(0, Math.min(deck.length - 1, i)));

  const phase = card.phase;
  const phaseColors = {
    teaching: { bg: "var(--washi)", accent: "var(--ink)" },
    practice: { bg: "var(--washi)", accent: "var(--vermilion)" },
    results:  { bg: "var(--ink)",   accent: "var(--vermilion)" },
  };
  const pc = phaseColors[phase] || phaseColors.teaching;

  const teachingCount = deck.filter(c => c.phase === "teaching").length;
  const practiceCount = deck.filter(c => c.phase === "practice").length;
  const progressPct   = idx / (deck.length - 1);

  const drillScore = () => {
    const drills = deck.filter(c => c.type === "drill");
    return drills.filter(c => drillAnswers[c.drillIdx] === g.quiz[c.drillIdx].answer).length;
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--washi)", fontFamily: "var(--font-ui)",
    }}>
      {/* Header */}
      <GrammarCardsHeader
        g={g} idx={idx} deck={deck} phase={phase}
        progressPct={progressPct}
        teachingCount={teachingCount} practiceCount={practiceCount}
        onClose={() => window.rikizoNav && window.rikizoNav("home")}
        onJump={go}
        bookmarkId={card.type === "rule" ? `${g.id}_${card.rule.id}` : g.id}
      />

      {/* Card body */}
      <div key={idx} className="noscroll" style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        animation: "glossFadeIn 0.22s ease",
      }}>
        {card.type === "intro"      && <IntroCard g={g} />}
        {card.type === "rule"       && <RuleCard rule={card.rule} grammar={g} />}
        {card.type === "comparison" && <StandaloneComparisonCard comparison={g.comparison} />}
        {card.type === "table"      && <StandaloneTableCard table={g.table} />}
        {card.type === "drill"      && (
          <DrillCard
            q={g.quiz[card.drillIdx]}
            qNum={card.drillNum}
            qTotal={practiceCount}
            picked={drillAnswers[card.drillIdx] ?? null}
            onPick={(ci) => setDrillAnswers(a => ({ ...a, [card.drillIdx]: ci }))}
          />
        )}
        {card.type === "score" && (
          <ScoreCard
            g={g} deck={deck} drillAnswers={drillAnswers}
            score={drillScore()} total={practiceCount}
            onRetry={() => { setDrillAnswers({}); go(deck.findIndex(c => c.type === "drill")); }}
            onHome={() => window.rikizoNav && window.rikizoNav("home")}
          />
        )}
      </div>

      {/* Footer */}
      {card.type !== "score" && (
        <div style={{
          padding: "10px 16px 28px",
          background: "var(--washi)",
          borderTop: "1px solid var(--hairline)",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          {!isFirst && (
            <button onClick={() => go(idx - 1)} style={cardsBackBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <button
            onClick={() => canAdvance() && go(idx + 1)}
            disabled={!canAdvance()}
            style={{
              flex: 1, height: 46, borderRadius: 999, border: "none",
              background: canAdvance() ? "var(--ink)" : "var(--hairline)",
              color: canAdvance() ? "var(--washi)" : "var(--ink-3)",
              fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
              cursor: canAdvance() ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}>
            {nextLabel(card, deck[idx + 1])}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Deck builder ─────────────────────────────────────────────
function buildDeck(g) {
  const deck = [];
  deck.push({ type: "intro",      phase: "teaching" });

  // Rules — comparison card injected after たいです (idx 1 among rules)
  g.rules.forEach((rule, i) => {
    deck.push({ type: "rule", phase: "teaching", rule });
    if (rule.id === "tai") {
      deck.push({ type: "comparison", phase: "teaching" });
    }
  });

  deck.push({ type: "table", phase: "teaching" });

  // MCQ drills
  g.quiz.forEach((q, i) => {
    deck.push({ type: "drill", phase: "practice", drillIdx: i, drillNum: i + 1 });
  });

  deck.push({ type: "score", phase: "results" });
  return deck;
}

function nextLabel(card, next) {
  if (!next) return "Finish";
  if (card.type === "intro") return "Start learning";
  if (card.type === "table") return "Practice";
  if (card.type === "drill") {
    if (!next || next.type === "score") return "See results";
    return `Next question`;
  }
  if (next.type === "drill") return "Practice";
  if (next.type === "comparison") return "Compare";
  if (next.type === "table") return "Reference table";
  if (next.type === "rule") return `Rule · ${next.rule.label}`;
  return "Next";
}

// ── Header ───────────────────────────────────────────────────
function GrammarCardsHeader({ g, idx, deck, phase, progressPct, teachingCount, practiceCount, onClose, onJump, bookmarkId }) {
  const phaseLabel = { teaching: "Teaching", practice: "Practice", results: "Results" }[phase];
  const dark = phase === "results";

  return (
    <div style={{
      padding: "54px 18px 14px",
      background: dark ? "var(--ink)" : "var(--washi)",
      borderBottom: `1px solid ${dark ? "oklch(0.97 0.008 80 / 0.15)" : "var(--hairline)"}`,
      color: dark ? "var(--washi)" : "var(--ink)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 999,
          border: `1px solid ${dark ? "oklch(0.97 0.008 80 / 0.25)" : "var(--hairline)"}`,
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: dark ? "var(--washi)" : "var(--ink-2)",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600,
          }}>{g.code} · {phaseLabel.toUpperCase()}</div>
          <div style={{
            fontFamily: "var(--font-jp-display)", fontWeight: 600, fontSize: 16,
            letterSpacing: "-0.01em", marginTop: 1,
            color: dark ? "var(--washi)" : "var(--ink)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{g.title}</div>
        </div>

        <BookmarkBtn id={bookmarkId} size={32} />
      </div>

      {/* Progress rail */}
      <div style={{ marginTop: 14, position: "relative" }}>
        {/* Phase labels */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 9.5, color: dark ? "oklch(0.97 0.008 80 / 0.55)" : "var(--ink-3)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase",
          marginBottom: 6,
        }}>
          <span>Teaching · {teachingCount}</span>
          <span>Practice · {practiceCount}</span>
          <span>{idx + 1}/{deck.length}</span>
        </div>
        <div style={{
          height: 4, borderRadius: 999,
          background: dark ? "oklch(0.97 0.008 80 / 0.15)" : "var(--hairline)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${progressPct * 100}%`,
            background: "var(--vermilion)",
            borderRadius: 999, transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

const cardsBackBtn = {
  width: 46, height: 46, borderRadius: 999,
  border: "1px solid var(--hairline)", background: "transparent",
  color: "var(--ink-2)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

// ── Card: Intro ───────────────────────────────────────────────
function IntroCard({ g }) {
  return (
    <div style={{ padding: "28px 22px 40px", position: "relative", overflow: "hidden" }}>
      {/* Ghost kanji */}
      <div style={{
        position: "absolute", right: -30, top: -10,
        fontFamily: "var(--font-jp-display)", fontSize: 240,
        lineHeight: 0.85, fontWeight: 500,
        color: "var(--washi-3)", pointerEvents: "none",
      }}>文</div>

      <div className="mono" style={{
        fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600,
      }}>{g.code} · N5 GRAMMAR</div>

      <h1 style={{
        fontFamily: "var(--font-jp-display)", fontSize: 34, fontWeight: 600,
        letterSpacing: "-0.02em", lineHeight: 1.1, margin: "8px 0 6px",
        color: "var(--ink)", position: "relative",
      }}>{g.title}</h1>

      <div style={{
        fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5,
        fontStyle: "italic", marginBottom: 28, position: "relative",
      }}>{g.focus}</div>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        padding: "16px 0", marginBottom: 24,
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <IntroStat label="Rules" value={`${window.RikizoGrammar.rules.length}`} />
        <IntroStat label="Minutes" value={`~${g.minutes}`} />
        <IntroStat label="XP" value="+240" color="var(--vermilion)" />
      </div>

      {/* Why it matters */}
      <div style={{ marginBottom: 22 }}>
        <MetaLabel>Why this matters</MetaLabel>
        <div style={{
          marginTop: 8, fontSize: 13.5, lineHeight: 1.65, color: "var(--ink)",
        }}>{g.whyItMatters}</div>
      </div>

      {/* What you'll learn */}
      <div>
        <MetaLabel>In this module</MetaLabel>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {g.rules.map((r, i) => (
            <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <div className="mono" style={{
                fontSize: 9.5, color: "var(--vermilion)", fontWeight: 700,
                letterSpacing: "0.1em", width: 18, flexShrink: 0,
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ flex: 1 }}>
                <span className="jp-serif" style={{
                  fontSize: 16, fontWeight: 600, color: "var(--ink)",
                  marginRight: 8,
                }}>{r.label}</span>
                <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
                  {r.tagline} — {r.meaning}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <RelatedLessonChip lesson={g.relatedLesson} />
      </div>
    </div>
  );
}

function IntroStat({ label, value, color = "var(--ink)" }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600,
        letterSpacing: "-0.02em", color, lineHeight: 1,
      }}>{value}</div>
      <div className="mono" style={{
        fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase",
        letterSpacing: "0.12em", marginTop: 6,
      }}>{label}</div>
    </div>
  );
}

// ── Card: Rule ───────────────────────────────────────────────
function RuleCard({ rule, grammar }) {
  return (
    <div style={{ padding: "22px 20px 32px", position: "relative", overflow: "hidden" }}>
      {/* Ghost */}
      <div style={{
        position: "absolute", right: -24, top: -10,
        fontFamily: "var(--font-jp-display)", fontSize: 200,
        lineHeight: 0.85, fontWeight: 500,
        color: "var(--washi-3)", pointerEvents: "none",
      }}>{rule.label.charAt(0)}</div>

      <div style={{ position: "relative" }}>
        <div className="mono" style={{
          fontSize: 9.5, color: "var(--vermilion)", letterSpacing: "0.16em",
          textTransform: "uppercase", fontWeight: 700,
        }}>{rule.tagline}</div>
        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 30, fontWeight: 600,
          letterSpacing: "-0.02em", marginTop: 4, lineHeight: 1.1,
        }}>{rule.label}</div>
        <div style={{
          fontSize: 13, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.4,
          fontStyle: "italic",
        }}>{rule.meaning}</div>
      </div>

      {/* Pattern formation */}
      <div style={{
        marginTop: 18, padding: "14px",
        background: "var(--washi-2)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
      }}>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: "0.14em", color: "var(--ink-3)",
          textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
        }}>Pattern</div>
        <PatternChain pattern={rule.pattern} style="compact" />
      </div>

      {/* Explanation */}
      <div style={{ marginTop: 18 }}>
        <MetaLabel>How it works</MetaLabel>
        <div style={{
          marginTop: 8, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)",
        }}>{rule.explanation}</div>
      </div>

      {/* Notes — minimal */}
      <div style={{ marginTop: 18 }}>
        <MetaLabel>Notes</MetaLabel>
        <ul style={{
          margin: "8px 0 0", padding: "0 0 0 16px",
          fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)",
          display: "flex", flexDirection: "column", gap: 2,
          listStyle: "none", paddingLeft: 0,
        }}>
          {rule.notes.map((n, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span className="mono" style={{
                fontSize: 9, color: "var(--vermilion)", fontWeight: 700,
                width: 16, flexShrink: 0, paddingTop: 4, letterSpacing: "0.08em",
              }}>·</span>
              <span style={{ fontFamily: "var(--font-ui)" }}>{n}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Examples */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        }}>
          <MetaLabel>Examples</MetaLabel>
          <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <span className="mono" style={{
            fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.08em",
          }}>tap chunks for gloss</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rule.examples.map((ex, i) => (
            <ExampleBlock key={i} ex={ex} variant="compact" showContext={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Card: Comparison (standalone) ───────────────────────────
function StandaloneComparisonCard({ comparison }) {
  return (
    <div style={{ padding: "24px 20px 32px" }}>
      <div className="mono" style={{
        fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em",
        fontWeight: 700, textTransform: "uppercase", marginBottom: 6,
      }}>Compare</div>
      <h2 style={{
        fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.02em", margin: "0 0 4px",
      }}>{comparison.title}</h2>
      <div style={{
        fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 20,
      }}>{comparison.subtitle}</div>

      <ComparisonCard comparison={comparison} />

      {comparison.tip && (
        <div style={{
          marginTop: 14, padding: "12px 14px",
          background: "var(--washi-2)",
          border: "1px dashed var(--hairline)",
          borderRadius: 8,
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          <strong style={{ color: "var(--vermilion)", marginRight: 6, fontStyle: "normal" }}>TIP</strong>
          {comparison.tip}
        </div>
      )}
    </div>
  );
}

// ── Card: Table (standalone) ─────────────────────────────────
function StandaloneTableCard({ table }) {
  return (
    <div style={{ padding: "24px 20px 32px" }}>
      <div className="mono" style={{
        fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em",
        fontWeight: 700, textTransform: "uppercase", marginBottom: 6,
      }}>Reference</div>
      <h2 style={{
        fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.02em", margin: "0 0 4px",
      }}>{table.title}</h2>
      <div style={{
        fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 20,
      }}>{table.description}</div>
      <FormsTable table={table} />
      <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
        Use this as a quick reference while practicing. The patterns all use the ます-stem or て-form — both from G8.
      </div>
    </div>
  );
}

// ── Card: MCQ Drill ──────────────────────────────────────────
function DrillCard({ q, qNum, qTotal, picked, onPick }) {
  const answered = picked != null;
  const correct  = picked === q.answer;

  return (
    <div style={{ padding: "28px 20px 32px" }}>
      {/* Phase indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div className="mono" style={{
          fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em",
          fontWeight: 700, textTransform: "uppercase",
        }}>Practice</div>
        <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
        <div className="mono" style={{
          fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em",
        }}>{qNum} / {qTotal}</div>
      </div>

      {/* Question */}
      <div style={{
        padding: "20px 18px",
        background: "var(--washi-2)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        marginBottom: 22,
      }}>
        <div className="jp-serif" style={{
          fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: "var(--ink)",
        }}>{q.q}</div>
      </div>

      {/* Choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.choices.map((c, ci) => {
          const isSelected = picked === ci;
          const isCorrect  = ci === q.answer;
          let bg = "var(--washi)";
          let border = "1px solid var(--hairline)";
          let color = "var(--ink)";
          let icon = null;

          if (answered) {
            if (isCorrect)  { bg = "oklch(0.90 0.06 140)"; border = "none"; }
            if (isSelected && !isCorrect) { bg = "oklch(0.90 0.06 30)"; border = "none"; }
            if (isCorrect) icon = <span style={{ color: "var(--moss)", fontWeight: 700, marginLeft: "auto" }}>✓</span>;
            if (isSelected && !isCorrect) icon = <span style={{ color: "var(--vermilion)", fontWeight: 700, marginLeft: "auto" }}>✗</span>;
          } else if (isSelected) {
            bg = "var(--ink)"; color = "var(--washi)"; border = "none";
          }

          return (
            <button key={ci} onClick={() => !answered && onPick(ci)} style={{
              padding: "14px 16px", background: bg, border, color,
              borderRadius: "var(--r-md)", cursor: answered ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 10,
              textAlign: "left", transition: "all 0.15s",
            }}>
              <span className="mono" style={{
                fontSize: 10.5, letterSpacing: "0.1em", fontWeight: 700,
                color: answered ? (isCorrect ? "var(--moss)" : isSelected ? "var(--vermilion)" : "var(--ink-3)") : (isSelected ? "var(--washi)" : "var(--ink-3)"),
                flexShrink: 0, width: 18,
              }}>{String.fromCharCode(65 + ci)}</span>
              <span className="jp-serif" style={{
                fontSize: 15, fontWeight: 500, letterSpacing: "0.01em", flex: 1,
              }}>{c}</span>
              {icon}
            </button>
          );
        })}
      </div>

      {/* Explanation after answer */}
      {answered && (
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: correct ? "oklch(0.95 0.03 140)" : "oklch(0.95 0.03 30)",
          border: `1px solid ${correct ? "oklch(0.75 0.08 140)" : "oklch(0.75 0.08 30)"}`,
          borderRadius: "var(--r-md)",
          animation: "glossFadeIn 0.25s ease",
        }}>
          <div className="mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            color: correct ? "oklch(0.35 0.1 140)" : "oklch(0.4 0.14 30)",
            textTransform: "uppercase", marginBottom: 5,
          }}>{correct ? "正解 · Correct" : "もう一度 · Try again"}</div>
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
            {q.explain}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card: Score ──────────────────────────────────────────────
function ScoreCard({ g, deck, drillAnswers, score, total, onRetry, onHome }) {
  const pct  = Math.round((score / total) * 100);
  const pass = pct >= 75;

  // Per-rule coverage (which rules were included)
  const rules = g.rules;

  return (
    <div style={{
      padding: "32px 22px 48px",
      background: "var(--ink)",
      minHeight: "100%",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Ghost */}
      <div style={{
        position: "absolute", right: -30, top: -20,
        fontFamily: "var(--font-jp-display)", fontSize: 300,
        lineHeight: 0.85, fontWeight: 500,
        color: "oklch(0.97 0.008 80 / 0.04)", pointerEvents: "none",
      }}>合</div>

      <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <div className="mono" style={{
          fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em",
          fontWeight: 700, textTransform: "uppercase", marginBottom: 10,
        }}>Results · {g.code}</div>

        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 28,
          fontWeight: 600, color: "var(--washi)", lineHeight: 1.15,
          marginBottom: 4,
        }}>おつかれさま</div>
        <div style={{
          fontSize: 13.5, color: "oklch(0.97 0.008 80 / 0.65)",
          lineHeight: 1.45, marginBottom: 28,
        }}>You finished {g.title}</div>

        {/* Hanko */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <Hanko size={64} rotate={-8}>合</Hanko>
          <div>
            <div style={{
              fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em",
              color: pass ? "oklch(0.75 0.12 140)" : "var(--vermilion)",
              lineHeight: 1,
            }}>{pct}%</div>
            <div className="mono" style={{
              fontSize: 10.5, color: "oklch(0.97 0.008 80 / 0.55)",
              letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2,
            }}>{score}/{total} correct</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1, background: "oklch(0.97 0.008 80 / 0.12)",
          borderRadius: "var(--r-md)", overflow: "hidden",
          marginBottom: 22,
        }}>
          <ScoreStat label="Rules" value={rules.length} />
          <ScoreStat label="Drills" value={total} />
          <ScoreStat label="XP" value={`+${Math.round(pct * 2.4)}`} accent />
        </div>

        {/* Rules covered */}
        <div style={{ marginBottom: 24 }}>
          <div className="mono" style={{
            fontSize: 9.5, color: "oklch(0.97 0.008 80 / 0.5)",
            letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
            marginBottom: 10,
          }}>Patterns covered</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {rules.map(r => (
              <div key={r.id} style={{
                padding: "6px 12px", borderRadius: 999,
                background: "oklch(0.97 0.008 80 / 0.1)",
                border: "1px solid oklch(0.97 0.008 80 / 0.2)",
                fontFamily: "var(--font-jp-display)", fontSize: 14, fontWeight: 500,
                color: "var(--washi)",
              }}>
                {r.label}
                <span className="mono" style={{
                  fontSize: 9, letterSpacing: "0.1em", marginLeft: 8,
                  color: "oklch(0.97 0.008 80 / 0.5)",
                }}>{r.tagline.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pass/fail message */}
        <div style={{
          padding: "14px 16px",
          background: pass ? "oklch(0.15 0.04 140)" : "oklch(0.15 0.04 30)",
          borderRadius: "var(--r-md)",
          border: `1px solid ${pass ? "oklch(0.4 0.08 140)" : "oklch(0.4 0.1 30)"}`,
          fontSize: 13, color: "var(--washi)", lineHeight: 1.55, marginBottom: 22,
        }}>
          {pass
            ? "Great work! Grammar unlocks the next lesson. Head to the Dojo to drill these patterns until they're automatic."
            : "Good effort. Review the rules you found tricky, then retry the practice section — aim for 75% to unlock the next content."}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!pass && (
            <button onClick={onRetry} style={{
              width: "100%", padding: "14px", borderRadius: 999,
              background: "var(--vermilion)", border: "none",
              color: "var(--washi)", fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}>Retry practice</button>
          )}
          <button onClick={onHome} style={{
            width: "100%", padding: "14px", borderRadius: 999,
            background: "oklch(0.97 0.008 80 / 0.1)",
            border: "1px solid oklch(0.97 0.008 80 / 0.2)",
            color: "var(--washi)", fontSize: 14, fontWeight: 600,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}>← Back to Home</button>
        </div>
      </div>
    </div>
  );
}

function ScoreStat({ label, value, accent }) {
  return (
    <div style={{
      padding: "14px 10px", textAlign: "center",
      background: "oklch(0.97 0.008 80 / 0.06)",
    }}>
      <div style={{
        fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.02em", lineHeight: 1,
        color: accent ? "var(--vermilion)" : "var(--washi)",
      }}>{value}</div>
      <div className="mono" style={{
        fontSize: 9.5, color: "oklch(0.97 0.008 80 / 0.5)",
        textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 6,
      }}>{label}</div>
    </div>
  );
}

Object.assign(window, { GrammarVariantCards });
