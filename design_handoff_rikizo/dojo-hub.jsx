// Dojo Screen — full redesign of Practice module.
// Hub + Flashcard flow + MCQ quiz + stubs for Scramble / Link Up / Conj Dojo.

// ─── Mode icons (inline SVG, no emoji) ───────────────────────
function ModeIcon({ type, color = "currentColor", size = 18 }) {
  const icons = {
    flip:    <><rect x="3" y="5" width="18" height="13" rx="3" stroke={color} strokeWidth="1.7" fill="none"/><path d="M3 10h18M9 5v13" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></>,
    mcq:     <><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" fill="none"/><path d="M9 12l2.5 2.5L15 9" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>,
    "mcq-r": <><path d="M12 3l9 9-9 9M3 12h18" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    read:    <><path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></>,
    conj:    <><path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    scramble:<><rect x="3" y="8" width="5" height="5" rx="1.5" stroke={color} strokeWidth="1.7" fill="none"/><rect x="10" y="8" width="5" height="5" rx="1.5" stroke={color} strokeWidth="1.7" fill="none"/><rect x="17" y="8" width="4" height="5" rx="1.5" stroke={color} strokeWidth="1.7" fill="none"/><path d="M5.5 16l3 3M10.5 16l-2 3M15 16l2 3" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></>,
    link:    <><circle cx="5" cy="12" r="2.5" stroke={color} strokeWidth="1.7" fill="none"/><circle cx="12" cy="6" r="2.5" stroke={color} strokeWidth="1.7" fill="none"/><circle cx="19" cy="12" r="2.5" stroke={color} strokeWidth="1.7" fill="none"/><circle cx="12" cy="18" r="2.5" stroke={color} strokeWidth="1.7" fill="none"/><path d="M7 11l4-4M17 11l-4-4M7 13l4 4M17 13l-4 4" stroke={color} strokeWidth="1.7" strokeLinecap="round"/></>,
    link4:   <><rect x="3" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth="1.7" fill="none"/><rect x="13" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth="1.7" fill="none"/><rect x="3" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth="1.7" fill="none"/><rect x="13" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth="1.7" fill="none"/></>,
    flag:    <><path d="M5 21V5" stroke={color} strokeWidth="1.7" strokeLinecap="round"/><path d="M5 5l7 3-7 3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      {icons[type] || icons.mcq}
    </svg>
  );
}

// ─── Dojo Screen (top-level router) ──────────────────────────
function DojoScreen() {
  const [view, setView] = React.useState("hub"); // hub | flash | quiz | stub
  const [activeMode, setActiveMode] = React.useState(null);
  const [showLessonPicker, setShowLessonPicker] = React.useState(false);

  const launch = (modeKey) => {
    setActiveMode(modeKey);
    if (modeKey === "flash-kanji") setView("flash");
    else if (modeKey === "flash-vocab") setView("flash-vocab");
    else if (modeKey === "dojo") setView("dojo-conj");
    else if (modeKey === "quiz-meaning" || modeKey === "quiz-meaning-r" || modeKey === "quiz-reading") setView("quiz");
    else setView("stub");
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {view === "hub" && (
        <DojoHub
          onLaunch={launch}
          onPickLesson={() => setShowLessonPicker(true)}
          onClose={() => window.rikizoNav && window.rikizoNav("home")}
        />
      )}
      {view === "flash"       && <DojoFlash onExit={() => setView("hub")} />}
      {view === "flash-vocab" && <DojoVocabFlash onExit={() => setView("hub")} />}
      {view === "dojo-conj"   && <DojoConj onExit={() => setView("hub")} />}
      {view === "quiz" && (
        <DojoQuiz mode={activeMode} onExit={() => setView("hub")} />
      )}
      {view === "stub" && (
        <DojoStub mode={activeMode} onExit={() => setView("hub")} />
      )}

      {showLessonPicker && (
        <LessonPickerPanel onClose={() => setShowLessonPicker(false)} />
      )}
    </div>
  );
}

// ─── Dojo Hub (main menu) ─────────────────────────────────────
function DojoHub({ onLaunch, onPickLesson, onClose }) {
  const d = window.RikizoDojo;

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--washi)",
    }}>
      {/* Dark hero header */}
      <div style={{
        padding: "54px 20px 20px",
        background: "var(--ink)", color: "var(--washi)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ghost kanji */}
        <div style={{
          position: "absolute", right: -20, top: -20,
          fontFamily: "var(--font-jp-display)", fontSize: 180,
          lineHeight: 0.85, fontWeight: 500,
          color: "oklch(0.97 0.008 80 / 0.06)",
          pointerEvents: "none", letterSpacing: "-0.05em",
        }}>道</div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 999, flexShrink: 0,
            border: "1px solid oklch(0.97 0.008 80 / 0.2)",
            background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--washi)", marginTop: 2,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div className="mono" style={{
              fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600,
            }}>DOJO · PRACTICE</div>
            <h1 style={{
              fontFamily: "var(--font-jp-display)", fontSize: 30, fontWeight: 600,
              letterSpacing: "-0.02em", margin: "4px 0 2px", lineHeight: 1.1, color: "var(--washi)",
            }}>どうじょう</h1>
            <div style={{ fontSize: 12.5, color: "oklch(0.97 0.008 80 / 0.6)" }}>
              Drill until it's automatic.
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{
          marginTop: 18, display: "flex", gap: 1,
          background: "oklch(0.97 0.008 80 / 0.1)",
          borderRadius: "var(--r-md)", overflow: "hidden",
        }}>
          {[
            { label: "Kanji",  val: d.stats.kanji,   color: "var(--washi)" },
            { label: "Vocab",  val: d.stats.vocab,   color: "var(--washi)" },
            { label: "Verbs",  val: d.stats.verbs,   color: "var(--washi)" },
            { label: "Flagged",val: d.stats.flagged, color: "var(--vermilion)" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: "10px 6px", textAlign: "center",
              background: "oklch(0.97 0.008 80 / 0.04)",
            }}>
              <div style={{
                fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600,
                letterSpacing: "-0.02em", color: s.color, lineHeight: 1,
              }}>{s.val}</div>
              <div className="mono" style={{
                fontSize: 9, color: "oklch(0.97 0.008 80 / 0.5)",
                textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Lesson selector chip */}
        <button onClick={onPickLesson} style={{
          marginTop: 14, padding: "8px 14px",
          background: "oklch(0.97 0.008 80 / 0.08)",
          border: "1px solid oklch(0.97 0.008 80 / 0.2)",
          borderRadius: 999, color: "var(--washi)",
          fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          justifyContent: "space-between",
        }}>
          <span>Studying: N5.9 · Relative Position</span>
          <span style={{ opacity: 0.6 }}>Change →</span>
        </button>
      </div>

      {/* Mode grid */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "12px 16px 40px" }}>
        {d.modes.map((cat) => (
          <DojoCategorySection key={cat.category} cat={cat} onLaunch={onLaunch} />
        ))}
      </div>
    </div>
  );
}

function DojoCategorySection({ cat, onLaunch }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Category header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
      }}>
        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 18,
          color: cat.accent, fontWeight: 600, lineHeight: 1,
        }}>{cat.kanji}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{cat.category}</div>
        <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {cat.items.map((item) => (
          <DojoModeRow key={item.key} item={item} accent={cat.accent} onLaunch={onLaunch} />
        ))}
      </div>
    </div>
  );
}

function DojoModeRow({ item, accent, onLaunch }) {
  return (
    <button onClick={() => onLaunch(item.key)} style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 14px", borderRadius: "var(--r-md)",
      background: "var(--washi)",
      border: "1px solid var(--hairline)",
      cursor: "pointer", textAlign: "left",
      transition: "all 0.12s",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, color: "var(--washi)",
      }}>
        <ModeIcon type={item.icon} color="var(--washi)" size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
          {item.label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{item.sub}</div>
      </div>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ color: "var(--ink-3)", flexShrink: 0 }}>
        <path d="M1 1l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ─── Flashcard Flow ───────────────────────────────────────────
const STREAK_TIERS = [
  { at: 3,  msg: "いいね！",     sub: "Nice!",        color: "oklch(0.75 0.12 85)"  },
  { at: 5,  msg: "すごい！",     sub: "Amazing!",     color: "oklch(0.65 0.18 30)"  },
  { at: 8,  msg: "さすが！",     sub: "Impressive!",  color: "oklch(0.6 0.15 300)"  },
  { at: 10, msg: "天才！",       sub: "Genius!",      color: "oklch(0.75 0.12 250)" },
];

function DojoFlash({ onExit }) {
  const cards = window.RikizoDojo.kanjiFlashcards;
  const [deck, setDeck] = React.useState(() => shuffle([...cards]));
  const [idx, setIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [streak, setStreak] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [hanabi, setHanabi] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const [stats, setStats] = React.useState({ got: 0, almost: 0, nope: 0 });

  const card = deck[idx];

  const grade = (grade) => {
    const newStreak = grade === "got" ? streak + 1 : 0;
    const newBest = Math.max(best, newStreak);
    setStreak(newStreak);
    setBest(newBest);
    setStats(s => ({ ...s, [grade]: s[grade] + 1 }));

    // Check streak tier
    const tier = [...STREAK_TIERS].reverse().find(t => newStreak >= t.at && newStreak % t.at === 0);
    if (tier) setHanabi(tier);

    if (idx + 1 >= deck.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  };

  const restart = () => {
    setDeck(shuffle([...cards]));
    setIdx(0); setFlipped(false); setStreak(0);
    setDone(false); setStats({ got: 0, almost: 0, nope: 0 }); setHanabi(null);
  };

  const glowColor = streak >= 10 ? "oklch(0.75 0.12 250 / 0.4)"
    : streak >= 8 ? "oklch(0.6 0.15 300 / 0.35)"
    : streak >= 5 ? "oklch(0.65 0.18 30 / 0.3)"
    : streak >= 3 ? "oklch(0.75 0.12 85 / 0.25)"
    : "transparent";

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--washi)",
    }}>
      {/* Header */}
      <div style={{
        padding: "54px 20px 14px",
        background: "var(--ink)", color: "var(--washi)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onExit} style={{
          width: 32, height: 32, borderRadius: 999,
          border: "1px solid oklch(0.97 0.008 80 / 0.2)",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--washi)", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>FLASHCARDS · KANJI</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--washi)", marginTop: 2 }}>N5.9 · Relative Position</div>
        </div>

        {/* Streak */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: streak > 0 ? "oklch(0.75 0.12 85)" : "oklch(0.97 0.008 80 / 0.4)", lineHeight: 1 }}>
            {streak}
          </div>
          <div className="mono" style={{ fontSize: 8.5, color: "oklch(0.97 0.008 80 / 0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>streak</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--hairline)" }}>
        <div style={{
          height: "100%", background: "var(--vermilion)", borderRadius: 999,
          width: `${(idx / deck.length) * 100}%`, transition: "width 0.3s ease",
        }}/>
      </div>

      {/* Card area */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 20px", gap: 20,
      }}>
        {done ? (
          <FlashDoneScreen stats={stats} total={deck.length} best={best} onRestart={restart} onExit={onExit} />
        ) : (
          <>
            {/* Flip card */}
            <div
              onClick={() => !flipped && setFlipped(true)}
              style={{
                width: "100%", height: 260,
                perspective: "1000px", cursor: flipped ? "default" : "pointer",
              }}>
              <div style={{
                width: "100%", height: "100%", position: "relative",
                transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                borderRadius: 20,
                boxShadow: `0 0 ${streak > 0 ? 30 : 0}px ${glowColor}, 0 12px 30px rgba(0,0,0,0.1)`,
                transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1), box-shadow 0.4s ease",
              }}>
                {/* Front */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 20,
                  backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                  background: "var(--washi)",
                  border: "1px solid var(--hairline)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 8,
                }}>
                  <div style={{
                    fontFamily: "var(--font-jp-display)", fontSize: 110,
                    fontWeight: 500, lineHeight: 1, color: "var(--ink)",
                  }}>{card.kanji}</div>
                  <div className="mono" style={{
                    fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em",
                    textTransform: "uppercase", fontWeight: 600,
                  }}>Tap to reveal</div>
                </div>

                {/* Back */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 20,
                  backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                  background: "var(--washi)",
                  border: "1px solid var(--hairline)",
                  transform: "rotateY(180deg)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "28px 24px", gap: 4,
                }}>
                  <div style={{
                    fontFamily: "var(--font-jp-display)", fontSize: 64,
                    fontWeight: 500, lineHeight: 1, color: "var(--ink)", marginBottom: 8,
                  }}>{card.kanji}</div>

                  <div className="jp-serif" style={{
                    fontSize: 24, fontWeight: 500, color: "var(--ink)", letterSpacing: "0.02em",
                  }}>{card.reading}</div>
                  <div className="mono" style={{
                    fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em",
                    textTransform: "uppercase", marginBottom: 4,
                  }}>on: {card.on}</div>

                  <div style={{
                    fontSize: 18, fontWeight: 600, color: "var(--ink-2)", textAlign: "center",
                    marginTop: 6,
                  }}>{card.meaning}</div>
                </div>
              </div>
            </div>

            {/* Counter */}
            <div className="mono" style={{
              fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.1em",
            }}>{idx + 1} / {deck.length}</div>

            {/* Grade buttons */}
            {flipped ? (
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <GradeBtn label="Nope" emoji="✗" color="var(--vermilion)" onClick={() => grade("nope")} />
                <GradeBtn label="Almost" emoji="〜" color="var(--ink-3)" onClick={() => grade("almost")} />
                <GradeBtn label="Got it" emoji="✓" color="var(--moss)" onClick={() => grade("got")} primary />
              </div>
            ) : (
              <div style={{
                padding: "12px", background: "var(--washi-2)",
                border: "1px dashed var(--hairline)", borderRadius: "var(--r-md)",
                fontSize: 12, color: "var(--ink-3)", textAlign: "center", width: "100%",
              }}>
                Read the kanji — then tap to reveal reading & meaning
              </div>
            )}
          </>
        )}
      </div>

      {/* Hanabi celebration */}
      {hanabi && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 20,
        }}>
          <div style={{
            fontFamily: "var(--font-jp-display)", fontSize: 56,
            fontWeight: 600, color: hanabi.color,
            textAlign: "center", animation: "hanabiPop 1.8s ease forwards",
          }}>
            {hanabi.msg}
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink-3)", marginTop: 4 }}>{hanabi.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeBtn({ label, emoji, color, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      flex: primary ? 2 : 1, height: 52, borderRadius: "var(--r-md)",
      border: primary ? "none" : "1px solid var(--hairline)",
      background: primary ? "var(--ink)" : "var(--washi)",
      color: primary ? "var(--washi)" : color,
      fontSize: 13, fontWeight: 700, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "all 0.12s",
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      {label}
    </button>
  );
}

function FlashDoneScreen({ stats, total, best, onRestart, onExit }) {
  const pct = Math.round((stats.got / total) * 100);
  return (
    <div style={{ width: "100%", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Hanko size={64} rotate={-8}>完</Hanko>
      </div>
      <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600 }}>Complete!</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4, marginBottom: 24 }}>
        Best streak: {best}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
        background: "var(--hairline)", borderRadius: "var(--r-md)",
        overflow: "hidden", marginBottom: 20,
      }}>
        {[
          { label: "Got it",  val: stats.got,    color: "var(--moss)" },
          { label: "Almost",  val: stats.almost, color: "var(--ink-3)" },
          { label: "Nope",    val: stats.nope,   color: "var(--vermilion)" },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "14px 8px", background: "var(--washi)", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600,
              color: s.color, lineHeight: 1,
            }}>{s.val}</div>
            <div className="mono" style={{
              fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase",
              letterSpacing: "0.12em", marginTop: 6,
            }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onRestart} style={{
          width: "100%", padding: "14px", borderRadius: 999,
          background: "var(--ink)", border: "none", color: "var(--washi)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>Shuffle & repeat</button>
        <button onClick={onExit} style={{
          width: "100%", padding: "14px", borderRadius: 999,
          background: "transparent", border: "1px solid var(--hairline)", color: "var(--ink-2)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>Back to Dojo</button>
      </div>
    </div>
  );
}


Object.assign(window, { ModeIcon, DojoScreen, DojoHub, DojoCategorySection, DojoModeRow, STREAK_TIERS, DojoFlash, GradeBtn, FlashDoneScreen });