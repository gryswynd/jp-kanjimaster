// Main Rikizo prototype — single phone + module router.
// Mode is now a single merged aesthetic (Dojo black + Play accents).

function RikizoHome() {
  const d = window.RikizoData;

  return (
    <div className="paper-bg" style={{
      width: "100%", height: "100%",
      overflow: "hidden", position: "relative",
      paddingBottom: 0,
    }}>
      <div className="noscroll" style={{
        height: "100%", overflowY: "auto",
        paddingBottom: 110,
        position: "relative", zIndex: 1,
      }}>
        <TopBar />
        <Masthead user={d.user} streak={d.streak} arc={d.arc} />

        <div style={{ height: 4 }} />
        <StreakCard streak={d.streak} />

        <SectionGap label="今日" en="Today" />
        <TodayCard today={d.today} onOpen={() => window.rikizoNav && window.rikizoNav("lesson")} />

        <div style={{ height: 10 }} />
        <ResumeCard resume={d.resume} onOpen={() => window.rikizoNav && window.rikizoNav("grammar")} />

        <SectionGap label="みち" en="Paths" />
        <ModuleGrid modules={d.modules} onOpen={(key) => window.rikizoNav && window.rikizoNav(key)} />

        <SectionGap label="しんちょく" en="Progress" />
        <LevelStrip level={d.level} />

        <div style={{ height: 14 }} />
        <CastRow cast={d.cast} />

        <SectionGap label="きょうのかんじ" en="Daily" />
        <ChallengeCard challenge={d.challenge} />

        <Colophon />
      </div>

      <TabBar />
    </div>
  );
}

function SectionGap({ label, en }) {
  return (
    <div style={{
      padding: "22px 22px 10px",
      display: "flex", alignItems: "baseline", gap: 10,
    }}>
      <div style={{
        fontFamily: "var(--font-jp-display)",
        fontSize: 13, color: "var(--ink-2)", fontWeight: 500,
        letterSpacing: "0.02em",
      }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      <MetaLabel>{en}</MetaLabel>
    </div>
  );
}

// ── Tweak panel ──────────────────────────────────────────────
function TweaksPanel({ screen, setScreen, grammarVariant, setGrammarVariant }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function onMsg(e) {
      if (!e.data || !e.data.type) return;
      if (e.data.type === "__activate_edit_mode") setVisible(true);
      if (e.data.type === "__deactivate_edit_mode") setVisible(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (!visible) return null;

  const setKey = (key, val) => {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*");
  };

  const screens = ["home", "lesson", "grammar", "practice", "compose", "story", "review", "game"];

  return (
    <div className="tweaks-panel">
      <h4>Tweaks</h4>
      <div className="label">Screen</div>
      <div className="row">
        {screens.map(s => (
          <button key={s}
            className={`chip ${screen === s ? "active" : ""}`}
            onClick={() => { setScreen(s); setKey("screen", s); }}
          >{s}</button>
        ))}
      </div>

      {screen === "grammar" && (
        <>
          <div className="label" style={{ marginTop: 12 }}>Grammar variant</div>
          <div className="row">
            {["scroll", "cards", "notebook"].map(v => (
              <button key={v}
                className={`chip ${grammarVariant === v ? "active" : ""}`}
                onClick={() => { setGrammarVariant(v); setKey("grammarVariant", v); }}
              >{v}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Placeholder for upcoming modules ─────────────────────────
function Placeholder({ name, kanji }) {
  return (
    <div className="paper-bg" style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 30px", textAlign: "center",
    }}>
      <div style={{
        fontFamily: "var(--font-jp-display)", fontSize: 120,
        color: "var(--washi-3)", lineHeight: 1, marginBottom: 20,
      }}>{kanji}</div>
      <MetaLabel>Next up</MetaLabel>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, marginBottom: 8 }}>{name}</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 240, lineHeight: 1.5 }}>
        Tell me to flesh this one out next.
      </div>
    </div>
  );
}

function App() {
  const defaults = window.TWEAK_DEFAULTS || {};
  const [screen, setScreen] = React.useState(defaults.screen || "home");
  const [grammarVariant, setGrammarVariant] = React.useState(defaults.grammarVariant || "scroll");

  React.useEffect(() => {
    window.rikizoNav = setScreen;
    return () => { delete window.rikizoNav; };
  }, []);

  const moduleInfo = {
    lesson:   { name: "Lessons",   kanji: "本" },
    grammar:  { name: "Grammar",   kanji: "文" },
    practice: { name: "Dojo",      kanji: "道" },
    compose:  { name: "Compose",   kanji: "作" },
    story:    { name: "Stories",   kanji: "語" },
    review:   { name: "Review",    kanji: "習" },
    game:     { name: "Adventure", kanji: "険" },
  };

  let content;
  if (screen === "home") content = <RikizoHome />;
  else if (screen === "lesson") content = <LessonScreen />;
  else if (screen === "compose") content = <ComposeScreen />;
  else if (screen === "story")   content = <StoryScreen />;
  else if (screen === "review")  content = <ReviewScreen />;
  else if (screen === "practice") content = <DojoScreen />;
  else if (screen === "grammar") {
    if (grammarVariant === "cards") content = <GrammarVariantCards />;
    else if (grammarVariant === "notebook") content = <GrammarVariantNotebook />;
    else content = <GrammarVariantScroll />;
  }
  else {
    const m = moduleInfo[screen] || { name: screen, kanji: "？" };
    content = <Placeholder name={m.name} kanji={m.kanji} />;
  }

  return (
    <>
      <style>{`
        .stage {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px;
        }
        .phone-label {
          font-family: var(--font-mono);
          font-size: 10.5px; color: var(--ink-3);
          letter-spacing: 0.18em; text-transform: uppercase;
        }
        .header-block {
          width: 100%; max-width: 720px; margin: 0 auto 24px;
          padding: 0 12px; text-align: center;
        }
        .header-block h1 {
          font-family: var(--font-ui);
          font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
          margin: 0 0 6px;
        }
        .header-block p {
          color: var(--ink-2); max-width: 520px; margin: 0 auto;
          line-height: 1.5; font-size: 13.5px;
        }
        .header-block .kicker {
          font-family: var(--font-mono);
          font-size: 11px; color: var(--vermilion);
          letter-spacing: 0.18em; text-transform: uppercase;
          margin-bottom: 8px;
        }
      `}</style>

      <div className="header-block">
        <div className="kicker">● Rikizo JP Lessons</div>
        <h1>{screen === "home" ? "Home screen" : (moduleInfo[screen]?.name || screen)}</h1>
        <p>Open <strong>Tweaks</strong> to jump between screens. Tap tiles on the home screen to navigate too.</p>
      </div>

      <div className="stage">
        <IOSDevice width={390} height={812} dark={false}>
          {content}
        </IOSDevice>
        <div className="phone-label">{screen}</div>
      </div>

      <TweaksPanel
        screen={screen} setScreen={setScreen}
        grammarVariant={grammarVariant} setGrammarVariant={setGrammarVariant}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
