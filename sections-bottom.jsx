// Lower sections: level progress, cast, daily challenge, tab bar.

// ─── Level progress strip — N5 overall ───────────────────────
function LevelStrip({ level }) {
  return (
    <div style={{ margin: "0 16px", padding: "14px 18px", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>N5</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{level.subtitle}</div>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {Math.round((level.lessonsDone / level.lessonsTotal) * 100)}% complete
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ProgressRow icon="本" label="Lessons" value={level.lessonsDone} total={level.lessonsTotal} color="var(--ink)" />
        <ProgressRow icon="字" label="Kanji" value={level.kanjiDone} total={level.kanjiTotal} color="var(--vermilion)" />
      </div>
    </div>
  );
}

function ProgressRow({ icon, label, value, total, color }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span className="jp-serif" style={{ fontSize: 12, color: "var(--ink-3)" }}>{icon}</span>
          <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{label}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {value}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}>/{total}</span>
        </div>
      </div>
      <InkBar value={value} total={total} color={color} height={4} />
    </div>
  );
}

// ─── Cast row — character portraits ──────────────────────────
function CastRow({ cast }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <MetaLabel>Cast · Chapter 3</MetaLabel>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{cast.filter(c=>c.seen).length}/{cast.length} met</div>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }} className="noscroll">
        {cast.map((c) => (
          <div key={c.id} style={{ flexShrink: 0, width: 58, textAlign: "center", opacity: c.seen ? 1 : 0.35 }}>
            <Portrait src={c.portrait} size={48} ring={c.id === "rikizo"} ringColor="var(--vermilion)" />
            <div className="jp-serif" style={{ fontSize: 10, marginTop: 5, color: "var(--ink-2)" }}>{c.jp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Kanji of the day ────────────────────────────────────────
function ChallengeCard({ challenge }) {
  return (
    <div style={{
      margin: "0 16px", padding: "16px 18px",
      borderRadius: "var(--r-lg)",
      background: "var(--washi-2)",
      border: "1px solid var(--hairline)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 58, height: 58, flexShrink: 0,
        background: "var(--washi)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-jp-display)",
        fontSize: 42, fontWeight: 500, color: "var(--ink)",
      }}>{challenge.kanji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MetaLabel>{challenge.title}</MetaLabel>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          {challenge.reading} · {challenge.meaning}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
          {challenge.prompt}
        </div>
      </div>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ color: "var(--ink-3)" }}>
        <path d="M1 1l7 6-7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ─── Bottom tab bar ──────────────────────────────────────────
function TabBar() {
  const [active, setActive] = React.useState("home");
  const tabs = [
    { key: "home",   label: "Home",  glyph: <path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/> },
    { key: "path",   label: "Path",  glyph: <><path d="M4 5h12a4 4 0 010 8H8a4 4 0 000 8h12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="4" cy="5" r="1.5" fill="currentColor"/><circle cx="20" cy="21" r="1.5" fill="currentColor"/></> },
    { key: "dojo",   label: "Dojo",  glyph: <><path d="M3 10l9-6 9 6v10H3V10z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"/><path d="M8 20v-5h8v5" stroke="currentColor" strokeWidth="1.8" fill="none"/></> },
    { key: "atlas",  label: "Atlas", glyph: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.8"/></> },
    { key: "me",     label: "Me",    glyph: <><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></> },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 34, left: 0, right: 0,
      padding: "8px 6px 10px",
      background: "oklch(0.97 0.008 80 / 0.88)",
      backdropFilter: "blur(14px)",
      borderTop: "1px solid var(--hairline)",
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => setActive(t.key)} style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: "6px 2px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          color: active === t.key ? "var(--ink)" : "var(--ink-3)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24">{t.glyph}</svg>
          <span style={{ fontSize: 10, fontWeight: active === t.key ? 600 : 500, letterSpacing: "0.02em" }}>{t.label}</span>
          {active === t.key && <div style={{ width: 14, height: 2, background: "var(--vermilion)", borderRadius: 999, marginTop: -1 }} />}
        </button>
      ))}
    </div>
  );
}

// ─── Colophon — small footer mark ────────────────────────────
function Colophon() {
  return (
    <div style={{ padding: "8px 16px 24px", textAlign: "center" }}>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.22em", textTransform: "uppercase" }}>
        Rikizo · 力蔵 · est. 2026
      </div>
    </div>
  );
}

Object.assign(window, { LevelStrip, CastRow, ChallengeCard, TabBar, Colophon });
