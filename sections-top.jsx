// Composite sections for the Rikizo home screen.

// ─── Top bar — small meta strip at the very top ───────────────
function TopBar() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "62px 22px 0",
    }}>
      <MetaLabel>{today} · N5 · Day 47</MetaLabel>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <IconBtn glyph="search" />
        <IconBtn glyph="bell" dot />
        <IconBtn glyph="gear" />
      </div>
    </div>
  );
}

function IconBtn({ glyph, dot }) {
  const icons = {
    search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20l-4.8-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    bell:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 18V10a6 6 0 1112 0v8h1.5M4.5 18h15M10 21.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    gear:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  };
  return (
    <button style={{
      width: 28, height: 28, borderRadius: 8,
      border: "1px solid var(--hairline)",
      background: "transparent", color: "var(--ink-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", position: "relative", padding: 0,
    }}>
      {icons[glyph]}
      {dot && <span style={{
        position: "absolute", top: 4, right: 4, width: 6, height: 6,
        borderRadius: 999, background: "var(--vermilion)",
      }}/>}
    </button>
  );
}

// ─── Masthead — big editorial greeting block ─────────────────
function Masthead({ user, streak, arc }) {
  const isDojo = false;
  const isPlay = true;

  const jpGreeting = streak.current >= 1
    ? [["お", "o"], ["帰", "kae"], ["り", "ri"], ["な", "na"], ["さ", "sa"], ["い", "i"]]
    : [["こ", "ko"], ["ん", "n"], ["に", "ni"], ["ち", "chi"], ["は", "wa"]];

  return (
    <div style={{ padding: "18px 22px 8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 500, lineHeight: 1.15, color: "var(--ink)", marginBottom: 6 }}>
            {jpGreeting.map((p, i) =>
              <ruby key={i}>{p[0]}<rt>{p[1]}</rt></ruby>
            )}<span style={{ color: "var(--vermilion)" }}>、</span>
            <br/>
            <span style={{ fontSize: 22, color: "var(--ink-2)" }}>Rikizo-san.</span>
          </div>
          <div style={{
            fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45,
            fontStyle: isDojo ? "normal" : "italic",
          }}>
            Chapter {arc.number} · <span style={{ color: "var(--ink-2)" }}>{arc.title}</span>
          </div>
        </div>

        <Hanko size={isPlay ? 52 : 44} rotate={-4}>力</Hanko>
      </div>
    </div>
  );
}

// ─── Streak card — belt + ring + dot history ─────────────────
function StreakCard({ streak, mode }) {
  const isDojo = true;
  return (
    <div style={{
      margin: "0 16px",
      padding: "16px 18px",
      borderRadius: "var(--r-lg)",
      background: isDojo ? "var(--ink)" : "var(--washi-2)",
      color: isDojo ? "var(--washi)" : "var(--ink)",
      border: isDojo ? "none" : "1px solid var(--hairline)",
      display: "flex", alignItems: "center", gap: 16,
      position: "relative", overflow: "hidden",
    }}>
      {/* Faint kanji watermark */}
      <div style={{
        position: "absolute", right: -20, top: -30,
        fontFamily: "var(--font-jp-display)", fontSize: 180,
        fontWeight: 700,
        color: isDojo ? "rgba(255,255,255,0.04)" : "oklch(0.22 0.012 60 / 0.04)",
        pointerEvents: "none", lineHeight: 1, letterSpacing: 0,
      }}>続</div>

      <BeltBadge stageKey={streak.stage.key} size={62} />

      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {streak.current}
          </div>
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            day streak
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
          {streak.stage.jp} · <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}>{streak.stage.en}</span>
        </div>
        <StreakDots history={streak.history} activeColor={isDojo ? "var(--vermilion)" : "var(--vermilion-ink)"} />
      </div>

      <div style={{
        textAlign: "right", fontSize: 11,
        color: isDojo ? "oklch(1 0 0 / 0.5)" : "var(--ink-3)",
        lineHeight: 1.5, position: "relative", zIndex: 1,
      }}>
        <div className="mono" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Best</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: isDojo ? "var(--washi)" : "var(--ink)" }}>{streak.best}</div>
        {streak.freezes > 0 && (
          <div style={{ marginTop: 4, color: isDojo ? "oklch(0.8 0.08 220)" : "var(--indigo)" }}>
            ❄ {streak.freezes} freeze{streak.freezes > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, Masthead, StreakCard, IconBtn });
