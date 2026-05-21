// Vocab Flashcards flow — part of Dojo extension.

function DojoVocabFlash({ onExit }) {
  const cards = window.RikizoDojo.vocabFlashcards;
  const [deck, setDeck]       = React.useState(() => dojoShuffle([...cards]));
  const [idx, setIdx]         = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [streak, setStreak]   = React.useState(0);
  const [best, setBest]       = React.useState(0);
  const [hanabi, setHanabi]   = React.useState(null);
  const [done, setDone]       = React.useState(false);
  const [stats, setStats]     = React.useState({ got: 0, almost: 0, nope: 0 });

  const card = deck[idx];

  const grade = (g) => {
    const ns = g === "got" ? streak + 1 : 0;
    const nb = Math.max(best, ns);
    setStreak(ns); setBest(nb);
    setStats(s => ({ ...s, [g]: s[g] + 1 }));
    const tier = [...STREAK_TIERS].reverse().find(t => ns >= t.at && ns % t.at === 0);
    if (tier) { setHanabi(tier); setTimeout(() => setHanabi(null), 1800); }
    if (idx + 1 >= deck.length) { setDone(true); return; }
    setIdx(i => i + 1); setFlipped(false);
  };

  const restart = () => {
    setDeck(dojoShuffle([...cards]));
    setIdx(0); setFlipped(false); setStreak(0); setBest(0);
    setDone(false); setStats({ got: 0, almost: 0, nope: 0 }); setHanabi(null);
  };

  const typeColor = (t) => ({
    noun: "var(--indigo)", "na-adj": "var(--moss)",
    direction: "var(--vermilion)", verb: "oklch(0.5 0.1 300)",
  }[t] || "var(--ink-3)");

  const glowColor = streak >= 5 ? "oklch(0.65 0.18 30 / 0.3)"
    : streak >= 3 ? "oklch(0.75 0.12 85 / 0.2)" : "transparent";

  const darkBack = {
    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
    border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--washi)",
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)", position: "relative" }}>
      <div style={{ padding: "54px 20px 14px", background: "var(--ink)", color: "var(--washi)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onExit} style={darkBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>VOCAB FLASHCARDS</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--washi)", marginTop: 2 }}>N5.9 · Relative Position</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: streak > 0 ? "oklch(0.75 0.12 85)" : "oklch(0.97 0.008 80 / 0.35)", lineHeight: 1 }}>{streak}</div>
          <div className="mono" style={{ fontSize: 8.5, color: "oklch(0.97 0.008 80 / 0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>streak</div>
        </div>
      </div>
      <div style={{ height: 3, background: "var(--hairline)" }}>
        <div style={{ height: "100%", background: "var(--vermilion)", borderRadius: 999, width: `${(idx / deck.length) * 100}%`, transition: "width 0.3s ease" }}/>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", gap: 18 }}>
        {done ? (
          <FlashDoneScreen stats={stats} total={deck.length} best={best} onRestart={restart} onExit={onExit} />
        ) : (
          <>
            <div onClick={() => !flipped && setFlipped(true)} style={{ width: "100%", height: 240, perspective: "1000px", cursor: flipped ? "default" : "pointer" }}>
              <div style={{
                width: "100%", height: "100%", position: "relative",
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                borderRadius: 18,
                boxShadow: `0 0 ${streak > 0 ? 28 : 0}px ${glowColor}, 0 10px 28px rgba(0,0,0,0.09)`,
                transition: "transform 0.5s cubic-bezier(0.4,0.2,0.2,1), box-shadow 0.4s ease",
              }}>
                {/* Front */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "var(--washi)", border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 58, fontWeight: 500, lineHeight: 1, color: "var(--ink)", marginBottom: 8 }}>{card.word}</div>
                  <div className="jp-sans" style={{ fontSize: 18, color: "var(--ink-2)", letterSpacing: "0.04em" }}>{card.reading}</div>
                  <div style={{ marginTop: 6, padding: "4px 10px", borderRadius: 999, background: typeColor(card.type) + "22", color: typeColor(card.type), fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase" }}>{card.type}</div>
                  <div className="mono" style={{ position: "absolute", bottom: 14, fontSize: 9.5, color: "var(--vermilion)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Tap to reveal</div>
                </div>
                {/* Back */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "var(--washi)", border: "2px solid var(--ink)", transform: "rotateY(180deg)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", padding: "22px 24px", gap: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: "var(--font-jp-display)", fontSize: 32, fontWeight: 500, color: "var(--ink)" }}>{card.word}</span>
                    <span className="jp-sans" style={{ fontSize: 14, color: "var(--ink-3)" }}>{card.reading}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{card.meaning}</div>
                  <div style={{ width: "100%", padding: "10px 12px", background: "var(--washi-2)", borderRadius: 8, border: "1px solid var(--hairline)" }}>
                    <div className="jp-serif" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: 1.55 }}>{card.example.jp}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4, fontStyle: "italic" }}>{card.example.en}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{idx + 1} / {deck.length}</div>

            {flipped ? (
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <GradeBtn label="Nope" emoji="✗" color="var(--vermilion)" onClick={() => grade("nope")} />
                <GradeBtn label="Almost" emoji="〜" color="var(--ink-3)" onClick={() => grade("almost")} />
                <GradeBtn label="Got it" emoji="✓" color="var(--moss)" onClick={() => grade("got")} primary />
              </div>
            ) : (
              <div style={{ width: "100%", padding: "12px", background: "var(--washi-2)", border: "1px dashed var(--hairline)", borderRadius: "var(--r-md)", fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>
                Read the word — then tap to reveal meaning & example
              </div>
            )}
          </>
        )}
      </div>

      {hanabi && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 52, fontWeight: 600, color: hanabi.color, textAlign: "center", animation: "hanabiPop 1.8s ease forwards" }}>
            {hanabi.msg}
            <div style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 500, marginTop: 4 }}>{hanabi.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function dojoShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Object.assign(window, { DojoVocabFlash, dojoShuffle });
