// Middle sections: Today card + Resume card + Module grid.

// ─── TodayCard — the hero "do this now" block ────────────────
function TodayCard({ today, onOpen }) {
  const isPlay = true;
  const isDojo = true;
  return (
    <div style={{
      margin: "0 16px",
      padding: "0",
      borderRadius: "var(--r-xl)",
      background: "var(--washi)",
      border: "1px solid var(--hairline)",
      overflow: "hidden",
      position: "relative",
      boxShadow: isPlay ? "0 10px 30px oklch(0.6 0.18 30 / 0.12)" : "0 2px 0 oklch(0.22 0.012 60 / 0.04)",
    }}>
      {/* Top strip */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--hairline)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: isDojo ? "var(--ink)" : "transparent",
        color: isDojo ? "var(--washi)" : "inherit",
      }}>
        <MetaLabel color={isDojo ? "oklch(1 0 0 / 0.5)" : "var(--vermilion)"}>
          ● Today's lesson · {today.lessonId}
        </MetaLabel>
        <div className="mono" style={{ fontSize: 11, color: isDojo ? "oklch(1 0 0 / 0.6)" : "var(--ink-3)" }}>
          ~{today.minutes} min
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px 20px", display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="jp-serif" style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 4 }}>
            {today.jp}
          </div>
          <h2 style={{
            margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em",
            lineHeight: 1.15, color: "var(--ink)",
          }}>{today.title}</h2>

          <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11 }}>
            <Stat label="new kanji" value={today.kanji.length} />
            <StatDivider />
            <Stat label="new terms" value={today.newTerms} />
            <StatDivider />
            <Stat label="chapter" value="3.4" mono />
          </div>

          <button onClick={onOpen} style={{
            marginTop: 16,
            padding: "11px 18px",
            borderRadius: 999,
            border: "none",
            background: "var(--vermilion)",
            color: "var(--washi)",
            fontSize: 14, fontWeight: 600,
            letterSpacing: "-0.01em",
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 10,
          }}>
            Begin lesson
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Accent kanji — huge display */}
        <div style={{
          width: 96, height: 96, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isPlay ? "var(--vermilion)" : "var(--washi-3)",
          color: isPlay ? "var(--washi)" : "var(--ink)",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--font-jp-display)",
          fontSize: 68, fontWeight: 500, lineHeight: 1,
          position: "relative",
        }}>
          {today.accentKanji}
          <div className="mono" style={{
            position: "absolute", bottom: -18, right: 0,
            fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em",
          }}>TEN · sky</div>
        </div>
      </div>

      {/* Kanji preview row */}
      <div style={{
        padding: "14px 20px 18px",
        borderTop: "1px dashed var(--hairline)",
      }}>
        <MetaLabel>In this lesson</MetaLabel>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {today.kanji.map((k, i) => <KanjiTile key={i} ch={k} size={30} />)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, fontFamily: mono ? "var(--font-mono)" : "inherit" }}>{value}</div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 2 }}>{label}</div>
    </div>
  );
}
function StatDivider() { return <div style={{ width: 1, background: "var(--hairline)" }} />; }

// ─── ResumeCard — lesson in progress ─────────────────────────
function ResumeCard({ resume, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      margin: "0 16px",
      padding: "14px 18px",
      borderRadius: "var(--r-lg)",
      border: "1px solid var(--hairline)",
      display: "flex", alignItems: "center", gap: 14,
      background: "transparent",
      cursor: "pointer",
    }}>
      <div style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: 10,
        background: "var(--moss)",
        color: "var(--washi)",
        fontFamily: "var(--font-jp-display)",
        fontSize: 26, fontWeight: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>文</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{resume.title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>· {resume.subtitle}</div>
        </div>
        <InkBar value={resume.progress} total={1} color="var(--moss)" height={4} />
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
        {Math.round(resume.progress * 100)}%
      </div>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ color: "var(--ink-3)" }}>
        <path d="M1 1l7 6-7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ─── Module grid — 2-col grid of app modules ────────────────
function ModuleGrid({ modules, onOpen }) {
  return (
    <div style={{ margin: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <MetaLabel>Practice</MetaLabel>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>7 paths</div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}>
        {modules.map((m) => <ModuleCell key={m.key} mod={m} onOpen={() => onOpen && onOpen(m.key)} />)}
      </div>
    </div>
  );
}

function ModuleCell({ mod, onOpen }) {
  const color = accentColor(mod.accent);
  const isPlay = true;
  return (
    <button onClick={onOpen} style={{
      textAlign: "left",
      padding: "14px 14px 12px",
      background: "var(--washi)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r-md)",
      cursor: "pointer",
      position: "relative",
      overflow: "hidden",
      minHeight: 92,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      borderTop: isPlay ? `3px solid ${color}` : "1px solid var(--hairline)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{mod.label}</div>
          <div className="jp-serif" style={{ fontSize: 11, color: "var(--ink-3)" }}>{mod.jp}</div>
        </div>
        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 500,
          color, lineHeight: 1,
        }}>{mod.kanji}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {mod.streak > 0 ? (
          <>
            <div style={{ width: 4, height: 4, borderRadius: 999, background: color }} />
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {mod.streak}-day streak
            </div>
          </>
        ) : (
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Ready
          </div>
        )}
      </div>
    </button>
  );
}

Object.assign(window, { TodayCard, ResumeCard, ModuleGrid, ModuleCell });
