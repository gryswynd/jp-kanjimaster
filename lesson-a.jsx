// Rikizo Lesson Player — a guided section-by-section experience.
// Sections: intro → warmup → kanji → vocab → convo → drill → close
// Each has its own bespoke layout. No generic cards.

function LessonScreen() {
  const lesson = window.RikizoLesson;
  const defaults = window.TWEAK_DEFAULTS || {};
  const [sectionIdx, setSectionIdx] = React.useState(defaults.lessonSection || 0);
  const sections = lesson.sectionsMeta;
  const current = sections[sectionIdx];

  const go = (i) => {
    const next = Math.max(0, Math.min(sections.length - 1, i));
    setSectionIdx(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { lessonSection: next } }, "*");
  };

  const next = () => go(sectionIdx + 1);
  const prev = () => go(sectionIdx - 1);

  return (
    <div className="paper-bg" style={{
      width: "100%", height: "100%", overflow: "hidden",
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      <LessonHeader lesson={lesson} sections={sections} idx={sectionIdx} onClose={() => window.rikizoNav && window.rikizoNav("home")} onJump={go} />

      <div key={sectionIdx} className="noscroll lesson-body" style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        position: "relative", animation: "lessonFadeIn 0.3s ease",
      }}>
        {current.key === "intro"   && <IntroPanel lesson={lesson} />}
        {current.key === "warmup"  && <WarmupPanel />}
        {current.key === "kanji"   && <KanjiPanel lesson={lesson} />}
        {current.key === "vocab"   && <VocabPanel lesson={lesson} />}
        {current.key === "convo"   && <ConvoPanel lesson={lesson} />}
        {current.key === "reading" && <ReadingPanel lesson={lesson} />}
        {current.key === "drill"   && <DrillPanel lesson={lesson} />}
        {current.key === "close"   && <ClosePanel lesson={lesson} />}
      </div>

      <LessonFooter
        idx={sectionIdx}
        total={sections.length}
        current={current}
        nextLabel={sections[sectionIdx + 1]?.label}
        onPrev={prev}
        onNext={next}
        isLast={sectionIdx === sections.length - 1}
        onFinish={() => window.rikizoNav && window.rikizoNav("home")}
      />

      <style>{`
        @keyframes lessonFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Header with X, title, and a segmented progress rail ─────
function LessonHeader({ lesson, sections, idx, onClose, onJump }) {
  return (
    <div style={{
      padding: "54px 18px 14px",
      background: "var(--washi)",
      borderBottom: "1px solid var(--hairline)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 999,
          border: "1px solid var(--hairline)",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-2)", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>
            N5 · LESSON {lesson.id.split(".")[1]}
          </div>
          <div style={{
            fontFamily: "var(--font-jp-display)", fontWeight: 600, fontSize: 17,
            letterSpacing: "-0.01em", marginTop: 1, color: "var(--ink)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{lesson.title}</div>
        </div>
        <div className="mono" style={{
          fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em",
          padding: "4px 8px", border: "1px solid var(--hairline)", borderRadius: 4,
        }}>{idx + 1}/{sections.length}</div>
      </div>

      {/* Segmented progress rail */}
      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {sections.map((s, i) => (
          <button key={s.key} onClick={() => onJump(i)} style={{
            flex: 1, height: 3, background: "transparent",
            border: "none", padding: 0, cursor: "pointer",
            position: "relative",
          }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: i < idx
                ? "var(--ink)"
                : i === idx
                ? "var(--vermilion)"
                : "var(--hairline)",
              transition: "background 0.2s",
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Footer: prev/next pill buttons ──────────────────────────
function LessonFooter({ idx, total, current, nextLabel, onPrev, onNext, isLast, onFinish }) {
  return (
    <div style={{
      padding: "12px 16px 28px",
      background: "var(--washi)",
      borderTop: "1px solid var(--hairline)",
      display: "flex", gap: 10, alignItems: "center",
    }}>
      {idx > 0 && (
        <button onClick={onPrev} style={{
          height: 46, padding: "0 16px", borderRadius: 999,
          border: "1px solid var(--hairline)",
          background: "transparent", color: "var(--ink-2)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back
        </button>
      )}
      <button onClick={isLast ? onFinish : onNext} style={{
        flex: 1, height: 46, borderRadius: 999,
        border: "none",
        background: isLast ? "var(--moss)" : "var(--ink)",
        color: "var(--washi)",
        fontSize: 14, fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
        letterSpacing: "-0.01em",
      }}>
        {isLast ? (
          <>Finish lesson
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </>
        ) : (
          <>Next{nextLabel ? <span style={{ opacity: 0.55, fontWeight: 400 }}>· {nextLabel}</span> : null}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </>
        )}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 1 — INTRO
// ═══════════════════════════════════════════════════════════
function IntroPanel({ lesson }) {
  return (
    <div style={{ padding: "28px 22px 40px", position: "relative" }}>
      <div style={{
        fontFamily: "var(--font-jp-display)",
        fontSize: 150, lineHeight: 0.9, fontWeight: 500,
        color: "var(--washi-3)",
        position: "absolute", right: -10, top: 0,
        letterSpacing: "-0.05em",
      }}>{lesson.kanji[0]}</div>

      <MetaLabel>Lesson · 9</MetaLabel>
      <div style={{
        fontFamily: "var(--font-jp-display)",
        fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em",
        lineHeight: 1.15, marginTop: 8, marginBottom: 6,
        color: "var(--ink)", position: "relative",
      }}>Relative<br/>Position.</div>
      <div className="jp-sans" style={{ fontSize: 15, color: "var(--ink-2)", position: "relative" }}>
        {"いち の ことば"}
      </div>

      <div style={{ height: 36 }} />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        marginBottom: 24,
      }}>
        {lesson.kanji.map((k, i) => (
          <div key={k} style={{
            aspectRatio: "1/1",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: i === 0 ? "var(--ink)" : "var(--washi-2)",
            color: i === 0 ? "var(--washi)" : "var(--ink)",
            borderRadius: 10, border: "1px solid var(--hairline)",
            fontFamily: "var(--font-jp-display)",
            fontSize: 36, fontWeight: 500,
          }}>{k}</div>
        ))}
      </div>

      <div style={{
        padding: "18px 0", borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2,
      }}>
        <Stat label="Minutes" value="24" />
        <Stat label="New words" value="13" />
        <Stat label="XP" value="+180" color="var(--vermilion)" />
      </div>

      <div style={{ marginTop: 24 }}>
        <MetaLabel>What you'll learn</MetaLabel>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <Bullet num="01">Say where things are: <em>in front of, behind, inside, outside</em></Bullet>
          <Bullet num="02">Use polite directions こちら/そちら/あちら/どちら</Bullet>
          <Bullet num="03">Read compounds 名前・外食・外人</Bullet>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "var(--ink)" }) {
  return (
    <div style={{ textAlign: "center", padding: "2px 4px" }}>
      <div style={{
        fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600,
        letterSpacing: "-0.02em", color, lineHeight: 1,
      }}>{value}</div>
      <div className="mono" style={{
        fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.12em",
        textTransform: "uppercase", marginTop: 6,
      }}>{label}</div>
    </div>
  );
}

function Bullet({ num, children }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <div className="mono" style={{
        fontSize: 10, color: "var(--vermilion)",
        fontWeight: 600, letterSpacing: "0.1em", width: 20, flexShrink: 0,
      }}>{num}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 2 — WARMUP (prior-knowledge sentences you translate)
// ═══════════════════════════════════════════════════════════
function WarmupPanel() {
  const items = [
    { jp: "今日 デパートへ 行きます。", reading: "きょう デパートへ いきます。", en: "I will go to the department store today.", tag: "Review" },
    { jp: "友だちと いっしょに 食べましょう。", reading: "ともだちと いっしょに たべましょう。", en: "Let's eat with a friend.", tag: "～ましょう" },
    { jp: "駅へ 来てください。", reading: "えきへ きてください。", en: "Please come to the station.", tag: "て-form" },
  ];
  const [revealed, setRevealed] = React.useState({});
  const toggle = (i) => setRevealed(r => ({ ...r, [i]: !r[i] }));

  return (
    <div style={{ padding: "24px 22px 32px" }}>
      <MetaLabel>Warmup · 2 min</MetaLabel>
      <h2 style={{
        fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.02em", margin: "6px 0 6px", color: "var(--ink)",
      }}>What do you remember?</h2>
      <div style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.5 }}>
        Try to read each sentence aloud before tapping to reveal the translation.
      </div>

      <div style={{ height: 20 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => toggle(i)} style={{
            textAlign: "left", padding: "16px 18px",
            borderRadius: "var(--r-md)",
            background: "var(--washi)",
            border: "1px solid var(--hairline)",
            cursor: "pointer", position: "relative",
          }}>
            <div style={{
              position: "absolute", top: 12, right: 12,
              fontSize: 9.5, fontFamily: "var(--font-mono)",
              color: "var(--ink-3)", letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>{item.tag}</div>

            <div className="jp-serif" style={{
              fontSize: 19, fontWeight: 500, color: "var(--ink)",
              lineHeight: 1.5, paddingRight: 60,
            }}>{item.jp}</div>
            <div className="jp-sans" style={{
              fontSize: 11.5, color: "var(--ink-3)", marginTop: 4,
            }}>{item.reading}</div>

            {revealed[i] ? (
              <div style={{
                marginTop: 10, paddingTop: 10,
                borderTop: "1px dashed var(--hairline)",
                fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5,
              }}>{item.en}</div>
            ) : (
              <div style={{
                marginTop: 10, fontSize: 11,
                color: "var(--vermilion)", fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}>Tap to reveal →</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 3 — NEW KANJI (interactive: pick one to study it)
// ═══════════════════════════════════════════════════════════
function KanjiPanel({ lesson }) {
  const [sel, setSel] = React.useState(0);
  const k = lesson.newKanji[sel];

  return (
    <div style={{ padding: "24px 0 32px" }}>
      <div style={{ padding: "0 22px" }}>
        <MetaLabel>New Kanji · 4 characters</MetaLabel>
        <h2 style={{
          fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.02em", margin: "6px 0 2px",
        }}>あたらしい かんじ</h2>
      </div>

      <div style={{ height: 20 }} />

      {/* Strip of small tiles */}
      <div style={{
        display: "flex", gap: 8, padding: "0 22px",
        overflowX: "auto",
      }} className="noscroll">
        {lesson.newKanji.map((kk, i) => (
          <button key={kk.k} onClick={() => setSel(i)} style={{
            flexShrink: 0, width: 66, height: 66, padding: 0,
            borderRadius: 10,
            background: sel === i ? "var(--ink)" : "var(--washi)",
            color: sel === i ? "var(--washi)" : "var(--ink)",
            border: sel === i ? "1px solid var(--ink)" : "1px solid var(--hairline)",
            fontFamily: "var(--font-jp-display)",
            fontSize: 36, fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s",
          }}>{kk.k}</button>
        ))}
      </div>

      {/* Focus card */}
      <div style={{
        margin: "22px 22px 0",
        padding: "24px 22px",
        background: "var(--washi)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Big ghost kanji in background */}
        <div style={{
          position: "absolute", right: -20, top: -30,
          fontFamily: "var(--font-jp-display)",
          fontSize: 220, lineHeight: 1,
          color: "var(--washi-3)", fontWeight: 500,
          pointerEvents: "none", userSelect: "none",
        }}>{k.k}</div>

        <div className="mono" style={{
          fontSize: 10, color: "var(--vermilion)",
          letterSpacing: "0.18em", fontWeight: 600, position: "relative",
        }}>{String(sel + 1).padStart(2, "0")} / 04</div>

        <div style={{
          fontFamily: "var(--font-jp-display)", fontSize: 76,
          lineHeight: 1, marginTop: 6, marginBottom: 10,
          color: "var(--ink)", fontWeight: 500, position: "relative",
        }}>{k.k}</div>

        <div style={{
          fontSize: 16, color: "var(--ink)", fontWeight: 600,
          letterSpacing: "-0.01em", position: "relative",
        }}>{k.meaning}</div>

        <div style={{ height: 16 }} />

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
          background: "var(--hairline)", borderRadius: 6,
          overflow: "hidden", position: "relative",
        }}>
          <Reading label="On'yomi" reading={k.on} />
          <Reading label="Kun'yomi" reading={k.kun} />
        </div>

        <div style={{ marginTop: 16, position: "relative" }}>
          <MetaLabel>Example</MetaLabel>
          <div className="jp-serif" style={{
            fontSize: 20, fontWeight: 500, marginTop: 6, color: "var(--ink)",
          }}>
            {exampleFor(k.k).jp}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>
            {exampleFor(k.k).en}
          </div>
        </div>
      </div>

      {/* Navigation hint */}
      <div style={{
        textAlign: "center", marginTop: 20,
        fontSize: 11, color: "var(--ink-3)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        Tap a character above
      </div>
    </div>
  );
}

function exampleFor(k) {
  return {
    "前": { jp: "駅の 前", en: "in front of the station" },
    "後": { jp: "駅の 後ろ", en: "behind the station" },
    "中": { jp: "店の 中", en: "inside the store" },
    "外": { jp: "外食", en: "eating out" },
  }[k] || { jp: "", en: "" };
}

function Reading({ label, reading }) {
  return (
    <div style={{ background: "var(--washi)", padding: "10px 12px" }}>
      <div className="mono" style={{
        fontSize: 9.5, color: "var(--ink-3)",
        letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500,
      }}>{label}</div>
      <div className="jp-sans" style={{
        fontSize: 16, color: "var(--ink)", marginTop: 3, fontWeight: 500,
      }}>{reading}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 4 — VOCABULARY (grouped list)
// ═══════════════════════════════════════════════════════════
function VocabPanel({ lesson }) {
  const [playing, setPlaying] = React.useState(null);
  return (
    <div style={{ padding: "24px 0 32px" }}>
      <div style={{ padding: "0 22px" }}>
        <MetaLabel>Vocabulary · 10 words</MetaLabel>
        <h2 style={{
          fontFamily: "var(--font-jp-display)", fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.02em", margin: "6px 0 2px",
        }}>ことば</h2>
        <div style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.5, marginTop: 4 }}>
          Tap a word to hear it. You'll see each word again in the conversation.
        </div>
      </div>

      <div style={{ height: 22 }} />

      {lesson.vocab.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 18 }}>
          <div style={{
            padding: "0 22px", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div className="mono" style={{
              fontSize: 10, color: "var(--ink-3)",
              letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500,
            }}>{String(gi + 1).padStart(2, "0")}</div>
            <div style={{
              fontFamily: "var(--font-jp-display)", fontSize: 14, fontWeight: 600,
              color: "var(--ink)",
            }}>{group.group}</div>
            <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          </div>

          {group.items.map((v, vi) => (
            <button key={vi} onClick={() => setPlaying(`${gi}-${vi}`)} style={{
              width: "100%", padding: "12px 22px",
              border: "none", borderBottom: "1px solid var(--hairline-2)",
              background: playing === `${gi}-${vi}` ? "var(--washi-2)" : "transparent",
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              textAlign: "left",
              transition: "background 0.12s",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: "var(--washi-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-2)", flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div className="jp-serif" style={{
                    fontSize: 20, fontWeight: 500, color: "var(--ink)",
                    letterSpacing: "0.01em",
                  }}>{v.jp}</div>
                  <div className="jp-sans" style={{
                    fontSize: 11.5, color: "var(--ink-3)",
                  }}>{v.reading}</div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>
                  {v.en}
                </div>
              </div>

              <div className="mono" style={{
                fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em",
              }}>{String(vi + 1).padStart(2, "0")}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PANEL 5 — CONVERSATION (messaging-style transcript)
// ═══════════════════════════════════════════════════════════
function ConvoPanel({ lesson }) {
  const c = lesson.conversation;
  const [showEn, setShowEn] = React.useState(false);

  return (
    <div style={{ padding: "24px 0 32px" }}>
      <div style={{ padding: "0 22px" }}>
        <MetaLabel>Conversation 1</MetaLabel>
        <h2 style={{
          fontFamily: "var(--font-jp-display)", fontSize: 24, fontWeight: 600,
          letterSpacing: "-0.02em", margin: "6px 0 6px", lineHeight: 1.25,
        }}>{c.title}</h2>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 12px", marginTop: 4,
          borderLeft: "2px solid var(--vermilion)",
          background: "var(--washi)",
        }}>
          <div style={{
            fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, fontStyle: "italic",
          }}>{c.context}</div>
        </div>

        <button onClick={() => setShowEn(v => !v)} style={{
          marginTop: 14, padding: "6px 12px",
          background: "transparent", border: "1px solid var(--hairline)",
          borderRadius: 999, color: "var(--ink-2)", fontSize: 11.5,
          fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          cursor: "pointer", textTransform: "uppercase", fontWeight: 500,
        }}>
          {showEn ? "Hide" : "Show"} English
        </button>
      </div>

      <div style={{ height: 20 }} />

      {/* Messages */}
      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {c.lines.map((line, i) => {
          const isRikizo = line.spk === "rikizo";
          const char = window.RikizoCharacters[line.spk];
          return (
            <div key={i} style={{
              display: "flex", gap: 8,
              flexDirection: isRikizo ? "row-reverse" : "row",
              alignItems: "flex-end",
            }}>
              <div style={{ flexShrink: 0, marginBottom: 2 }}>
                <Portrait src={char.portrait} size={32} />
              </div>

              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                background: isRikizo ? "var(--ink)" : "var(--washi)",
                color: isRikizo ? "var(--washi)" : "var(--ink)",
                border: isRikizo ? "none" : "1px solid var(--hairline)",
                borderRadius: isRikizo
                  ? "16px 16px 3px 16px"
                  : "16px 16px 16px 3px",
                position: "relative",
              }}>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: "0.1em",
                  color: isRikizo ? "oklch(0.97 0.008 80 / 0.6)" : "var(--ink-3)",
                  textTransform: "uppercase", fontWeight: 500, marginBottom: 3,
                }}>{char.jp}</div>

                <div className="jp-serif" style={{
                  fontSize: 15, lineHeight: 1.5, fontWeight: 500,
                }}>{line.jp}</div>

                {showEn && (
                  <div style={{
                    fontSize: 11.5, marginTop: 4, lineHeight: 1.45,
                    color: isRikizo ? "oklch(0.97 0.008 80 / 0.7)" : "var(--ink-3)",
                    fontStyle: "italic",
                  }}>{line.en}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


Object.assign(window, { LessonScreen, LessonHeader, LessonFooter, IntroPanel, WarmupPanel, KanjiPanel, VocabPanel, ConvoPanel, Stat, Bullet, exampleFor, Reading });