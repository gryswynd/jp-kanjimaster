// Stories — Part B: StoryReader (full reading experience).

function StoryReader({ id, onBack }) {
  const story = window.RikizoStories.activeStory; // demo always uses ame-no-hi-no-gakkou
  const [showEn, setShowEn]       = React.useState(false);
  const [revealedEn, setRevealedEn] = React.useState({}); // sentence-level toggle
  const [playing, setPlaying]     = React.useState(false);
  const [playingIdx, setPlayingIdx] = React.useState(-1);
  const [showVocab, setShowVocab] = React.useState(false);
  const [showGrammar, setShowGrammar] = React.useState(false);
  const [progress, setProgress]   = React.useState(0);
  const bodyRef = React.useRef(null);

  const toggleSentenceEn = (i) => setRevealedEn(r => ({ ...r, [i]: !r[i] }));

  const speakParagraph = (text, idx) => {
    setPlaying(true); setPlayingIdx(idx);
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP"; u.rate = 0.85;
      u.onend = () => { setPlaying(false); setPlayingIdx(-1); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      setTimeout(() => { setPlaying(false); setPlayingIdx(-1); }, 1200);
    }
  };

  const speakAll = () => {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); setPlayingIdx(-1); return; }
    const lines = story.paragraphs.map(p => p.jp);
    let idx = 0;
    const next = () => {
      if (idx >= lines.length) { setPlaying(false); setPlayingIdx(-1); return; }
      setPlayingIdx(idx);
      try {
        const u = new SpeechSynthesisUtterance(lines[idx]);
        u.lang = "ja-JP"; u.rate = 0.85;
        u.onend = () => { idx++; next(); };
        window.speechSynthesis.speak(u);
      } catch { idx++; next(); }
    };
    setPlaying(true);
    window.speechSynthesis.cancel();
    next();
  };

  const onScroll = (e) => {
    const el = e.target;
    const pct = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    setProgress(Math.round(pct * 100));
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {/* Header */}
      <div style={{
        padding: "54px 18px 12px", background: "var(--ink)", color: "var(--washi)",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button onClick={() => { window.speechSynthesis.cancel(); onBack(); }} style={storyBackBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "0.18em", fontWeight: 600 }}>N5 · {story.lessons.join(" · ")}</div>
          <div className="jp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--washi)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{story.titleJp}</div>
        </div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => setShowEn(v => !v)} style={{
            padding: "5px 10px", borderRadius: 999, cursor: "pointer",
            background: showEn ? "var(--gold)" : "oklch(0.97 0.008 80 / 0.1)",
            border: showEn ? "none" : "1px solid oklch(0.97 0.008 80 / 0.2)",
            color: "var(--washi)", fontFamily: "var(--font-mono)",
            fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
          }}>EN</button>
          <button onClick={speakAll} style={{
            width: 34, height: 34, borderRadius: 999, cursor: "pointer",
            background: playing ? "var(--vermilion)" : "oklch(0.97 0.008 80 / 0.1)",
            border: playing ? "none" : "1px solid oklch(0.97 0.008 80 / 0.2)",
            color: "var(--washi)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Read progress bar */}
      <div style={{ height: 3, background: "var(--hairline)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--gold)", width: `${progress}%`, transition: "width 0.1s" }}/>
      </div>

      {/* Body — scrollable story */}
      <div ref={bodyRef} onScroll={onScroll} className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "24px 20px 0" }}>

        {/* Story title block */}
        <div style={{ marginBottom: 28 }}>
          <div className="jp-serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2, marginBottom: 4 }}>{story.titleJp}</div>
          <div style={{ fontSize: 14, color: "var(--ink-3)", fontStyle: "italic" }}>{story.titleEn}</div>
        </div>

        {/* Paragraphs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginBottom: 32 }}>
          {story.paragraphs.map((p, i) => {
            const isPlaying = playingIdx === i;
            const enShown   = showEn || revealedEn[i];
            return (
              <div key={i} style={{
                position: "relative",
                padding: "14px 16px 14px 14px",
                borderRadius: "var(--r-md)",
                background: isPlaying ? "oklch(0.93 0.06 85 / 0.5)" : "transparent",
                border: isPlaying ? "1px solid oklch(0.78 0.1 85 / 0.6)" : "1px solid transparent",
                transition: "all 0.2s",
              }}>
                {/* Paragraph number */}
                <div className="mono" style={{
                  fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
                  position: "absolute", top: 14, right: 12,
                }}>{String(i + 1).padStart(2, "0")}</div>

                {/* JP text */}
                <div className="jp-serif" style={{
                  fontSize: 19, lineHeight: 1.9, fontWeight: 500,
                  color: "var(--ink)", paddingRight: 24,
                  letterSpacing: "0.01em",
                  textWrap: "pretty",
                }}>{p.jp}</div>

                {/* EN reveal */}
                {enShown ? (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: "1px dashed var(--hairline)",
                    fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6,
                    fontStyle: "italic",
                    animation: "glossFadeIn 0.2s ease",
                  }}>{p.en}</div>
                ) : (
                  <button onClick={() => toggleSentenceEn(i)} style={{
                    marginTop: 6, padding: 0, background: "none", border: "none",
                    color: "var(--ink-3)", cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 9.5,
                    letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                  }}>Show translation</button>
                )}

                {/* Audio button */}
                <button onClick={() => speakParagraph(p.jp, i)} style={{
                  position: "absolute", bottom: 12, right: 10,
                  width: 26, height: 26, borderRadius: 999, cursor: "pointer",
                  background: isPlaying ? "var(--gold)" : "var(--washi-2)",
                  border: "1px solid var(--hairline)", color: "var(--ink-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--hairline)", marginBottom: 24 }}/>

        {/* Vocabulary section */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowVocab(v => !v)} style={{
            width: "100%", textAlign: "left", padding: "12px 16px",
            background: "var(--washi-2)", border: "1px solid var(--hairline)",
            borderRadius: showVocab ? "var(--r-md) var(--r-md) 0 0" : "var(--r-md)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="jp-serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>語彙</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>Vocabulary · {story.vocab.length} words</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: showVocab ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showVocab && (
            <div style={{
              border: "1px solid var(--hairline)", borderTop: "none",
              borderRadius: "0 0 var(--r-md) var(--r-md)",
              background: "var(--washi)", overflow: "hidden",
              animation: "glossFadeIn 0.2s ease",
            }}>
              {story.vocab.map((v, i) => (
                <div key={i} style={{
                  padding: "10px 16px",
                  borderBottom: i < story.vocab.length - 1 ? "1px solid var(--hairline-2)" : "none",
                  display: "flex", alignItems: "baseline", gap: 12,
                }}>
                  <span className="jp-serif" style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", minWidth: 48 }}>{v.jp}</span>
                  <span className="jp-sans" style={{ fontSize: 12, color: "var(--ink-3)" }}>{v.reading}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontStyle: "italic" }}>{v.meaning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grammar section */}
        <div style={{ marginBottom: 40 }}>
          <button onClick={() => setShowGrammar(v => !v)} style={{
            width: "100%", textAlign: "left", padding: "12px 16px",
            background: "var(--washi-2)", border: "1px solid var(--hairline)",
            borderRadius: showGrammar ? "var(--r-md) var(--r-md) 0 0" : "var(--r-md)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="jp-serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>文法</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>Grammar points · {story.grammar.length}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: showGrammar ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showGrammar && (
            <div style={{
              border: "1px solid var(--hairline)", borderTop: "none",
              borderRadius: "0 0 var(--r-md) var(--r-md)",
              background: "var(--washi)", overflow: "hidden",
              animation: "glossFadeIn 0.2s ease",
            }}>
              {story.grammar.map((g, i) => (
                <div key={i} style={{
                  padding: "10px 16px",
                  borderBottom: i < story.grammar.length - 1 ? "1px solid var(--hairline-2)" : "none",
                  display: "flex", alignItems: "baseline", gap: 14,
                }}>
                  <span className="jp-serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--indigo)", minWidth: 120 }}>{g.pattern}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{g.meaning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StoryReader });
