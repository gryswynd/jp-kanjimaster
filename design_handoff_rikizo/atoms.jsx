// Reusable atoms for the home screen.

const rikizoBelts = {
  beginner:  "assets/ui/belt-white.png",
  daily:     "assets/ui/belt-yellow.png",
  week:      "assets/ui/belt-green.png",
  fortnight: "assets/ui/belt-blue.png",
  month:     "assets/ui/belt-purple.png",
  season:    "assets/ui/belt-brown.png",
  legend:    "assets/ui/belt-black.png",
};

const accentColor = (key) => ({
  ink: "var(--ink)",
  vermilion: "var(--vermilion)",
  moss: "var(--moss)",
  indigo: "var(--indigo)",
  gold: "var(--gold)",
}[key] || "var(--ink)");

// ── Hanko seal (red square stamp) ────────────────────────────
function Hanko({ children, size = 44, rotate = -3, style = {} }) {
  return (
    <span
      className="hanko jp-serif"
      style={{
        width: size, height: size,
        fontSize: size * 0.48,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >{children}</span>
  );
}

// ── Section label (uppercase mono meta) ─────────────────────
function MetaLabel({ children, color = "var(--ink-3)", align = "left" }) {
  return (
    <div className="mono" style={{
      fontSize: 10.5, color, letterSpacing: "0.14em",
      textTransform: "uppercase", fontWeight: 500, textAlign: align,
    }}>{children}</div>
  );
}

// ── Horizontal hairline with vertical ticks ─────────────────
function Hairline({ style = {} }) {
  return <div style={{ height: 1, background: "var(--hairline)", ...style }} />;
}

// ── Progress bar — thin, ink-stroked ────────────────────────
function InkBar({ value, total, color = "var(--ink)", height = 6 }) {
  const pct = Math.max(0, Math.min(1, total ? value / total : value));
  return (
    <div style={{
      position: "relative", height, borderRadius: 999,
      background: "var(--hairline-2)", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${pct * 100}%`, background: color,
        borderRadius: 999, transition: "width 0.4s ease",
      }} />
    </div>
  );
}

// ── Dot grid showing streak history (last 14 days) ──────────
function StreakDots({ history, activeColor = "var(--vermilion)" }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {history.map((active, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: 2,
          background: active ? activeColor : "var(--hairline)",
          opacity: active ? (0.55 + (i / history.length) * 0.45) : 1,
        }} />
      ))}
    </div>
  );
}

// ── Kanji tile — crisp square with furigana reading ─────────
function KanjiTile({ ch, size = 36, filled = false, onHover }) {
  return (
    <div
      onMouseEnter={onHover}
      style={{
        width: size, height: size,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 6,
        background: filled ? "var(--ink)" : "var(--washi-2)",
        color: filled ? "var(--washi)" : "var(--ink)",
        fontFamily: "var(--font-jp-display)",
        fontSize: size * 0.58,
        fontWeight: 500,
        border: filled ? "none" : "1px solid var(--hairline)",
        cursor: "default",
        transition: "all 0.15s",
      }}
    >{ch}</div>
  );
}

// ── Pixel portrait — for small character avatars ────────────
function Portrait({ src, size = 36, ring = false, ringColor = "var(--ink)" }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 999,
      background: "var(--washi-2)",
      border: ring ? `2px solid ${ringColor}` : "1px solid var(--hairline)",
      padding: 2,
      position: "relative",
      flexShrink: 0,
    }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 999, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--washi)",
      }}>
        <img
          src={src}
          className="pixel"
          style={{ width: "110%", height: "110%", objectFit: "cover", objectPosition: "center top" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      </div>
    </div>
  );
}

// ── Belt badge — uses real belt png ─────────────────────────
function BeltBadge({ stageKey = "week", size = 72 }) {
  const src = rikizoBelts[stageKey] || rikizoBelts.week;
  return (
    <img
      src={src}
      alt={`${stageKey} belt`}
      style={{
        width: size, height: "auto", display: "block",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
      }}
    />
  );
}

// ── Japanese line w/ optional furigana ──────────────────────
// Pairs expressed as [kanji, reading?] tuples. Readings are optional.
function Ruby({ pairs, size = 20, weight = 500 }) {
  return (
    <span style={{ fontFamily: "var(--font-jp-display)", fontSize: size, fontWeight: weight, letterSpacing: "0.01em" }}>
      {pairs.map((p, i) =>
        Array.isArray(p) && p[1] ? (
          <ruby key={i}>{p[0]}<rt>{p[1]}</rt></ruby>
        ) : (
          <span key={i}>{Array.isArray(p) ? p[0] : p}</span>
        )
      )}
    </span>
  );
}

Object.assign(window, {
  Hanko, MetaLabel, Hairline, InkBar, StreakDots,
  KanjiTile, Portrait, BeltBadge, Ruby,
  rikizoBelts, accentColor,
});
