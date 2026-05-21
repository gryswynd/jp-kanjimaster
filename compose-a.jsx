// Compose module — menu + compose view.
// Part A: ComposeScreen router + Menu + Compose header/prompt/textarea.

// Mock data mirroring compose.N5.x.json shape
window.RikizoCompose = {
  lessons: [
    {
      id: "compose.N5.1", lesson: "N5.1", level: "N5",
      title: "わたしのかぞく", titleEn: "My Family",
      theme: "Introduce your family members using 人, 男, 女, 父, 母.",
      emoji: "👨‍👩‍👧", promptCount: 4, challengeCount: 1, status: "done",
    },
    {
      id: "compose.N5.2", lesson: "N5.2", level: "N5",
      title: "まいにちのスケジュール", titleEn: "My Daily Schedule",
      theme: "Describe your week using days and time expressions.",
      emoji: "📅", promptCount: 4, challengeCount: 1, status: "draft",
    },
    {
      id: "compose.N5.9", lesson: "N5.9", level: "N5",
      title: "えきのまわり", titleEn: "Around the Station",
      theme: "Describe locations using position words: 前・後ろ・中・外.",
      emoji: "🚉", promptCount: 4, challengeCount: 2, status: "new",
    },
    {
      id: "compose.N5.10", lesson: "N5.10", level: "N5",
      title: "すきなたべもの", titleEn: "Favourite Foods",
      theme: "Write about what you like to eat and want to eat.",
      emoji: "🍜", promptCount: 4, challengeCount: 1, status: "locked",
    },
  ],

  // Full compose data for N5.9 (used in compose view)
  active: {
    id: "compose.N5.9", lesson: "N5.9",
    title: "えきのまわり", titleEn: "Around the Station",
    theme: "Describe the area around the station using position words.",
    emoji: "🚉",

    particles: [
      { id: "p_ni", particle: "に", role: "location marker" },
      { id: "p_no", particle: "の", role: "possessive / linking" },
      { id: "p_ga", particle: "が", role: "subject marker" },
      { id: "p_wa", particle: "は", role: "topic marker" },
      { id: "p_de", particle: "で", role: "location of action" },
    ],

    conjugations: [
      { pattern: "〜にあります", meaning: "exists (for things)", examples: ["あります", "ありません", "ありますか"] },
      { pattern: "〜にいます", meaning: "exists (for people/animals)", examples: ["います", "いません"] },
      { pattern: "〜ています", meaning: "is doing (progressive)", examples: ["飲んでいます", "食べています"] },
    ],

    prompts: [
      {
        num: 1,
        prompt: "駅の前に何がありますか。大きいお店を書いてください。",
        promptEn: "What is in front of the station? Write about a big shop.",
        targets: [
          { surface: "駅", reading: "えき", meaning: "station", matches: ["駅", "えき"], count: 1 },
          { surface: "前", reading: "まえ", meaning: "in front", matches: ["前", "まえ"], count: 1 },
          { surface: "あります", reading: "あります", meaning: "exists", matches: ["あります", "あった"], count: 1 },
        ],
        vocabPool: [
          { surface: "大きい", reading: "おおきい", meaning: "big" },
          { surface: "店", reading: "みせ", meaning: "shop/store" },
          { surface: "レストラン", reading: "レストラン", meaning: "restaurant" },
          { surface: "デパート", reading: "デパート", meaning: "department store" },
        ],
        model: "駅の前に大きいお店があります。",
      },
      {
        num: 2,
        prompt: "店の中には何がありますか。食べ物を書いてください。",
        promptEn: "What is inside the shop? Write about the food.",
        targets: [
          { surface: "中", reading: "なか", meaning: "inside", matches: ["中", "なか"], count: 1 },
          { surface: "カレー", reading: "カレー", meaning: "curry", matches: ["カレー"], count: 1 },
        ],
        vocabPool: [
          { surface: "パン", reading: "パン", meaning: "bread" },
          { surface: "カレー", reading: "カレー", meaning: "curry" },
          { surface: "コーヒー", reading: "コーヒー", meaning: "coffee" },
          { surface: "新しい", reading: "あたらしい", meaning: "new" },
        ],
        model: "店の中にカレーやパンがあります。",
      },
      {
        num: 3,
        prompt: "駅の後ろには何がありますか。書いてください。",
        promptEn: "What is behind the station? Write about it.",
        targets: [
          { surface: "後ろ", reading: "うしろ", meaning: "behind", matches: ["後ろ", "うしろ"], count: 1 },
          { surface: "車", reading: "くるま", meaning: "car", matches: ["車", "くるま"], count: 1 },
        ],
        vocabPool: [
          { surface: "車", reading: "くるま", meaning: "car" },
          { surface: "自転車", reading: "じてんしゃ", meaning: "bicycle" },
          { surface: "公園", reading: "こうえん", meaning: "park" },
        ],
        model: "駅の後ろに車があります。",
      },
      {
        num: 4,
        prompt: "外で何をしていますか。友だちについて書いてください。",
        promptEn: "What is happening outside? Write about a friend.",
        targets: [
          { surface: "外", reading: "そと", meaning: "outside", matches: ["外", "そと"], count: 1 },
          { surface: "います", reading: "います", meaning: "is here", matches: ["います", "いる"], count: 1 },
          { surface: "友だち", reading: "ともだち", meaning: "friend", matches: ["友だち", "ともだち"], count: 1 },
        ],
        vocabPool: [
          { surface: "友だち", reading: "ともだち", meaning: "friend" },
          { surface: "先生", reading: "せんせい", meaning: "teacher" },
          { surface: "飲んでいます", reading: "のんでいます", meaning: "is drinking" },
          { surface: "食べています", reading: "たべています", meaning: "is eating" },
        ],
        model: "外で友だちがコーヒーを飲んでいます。",
      },
    ],

    challengePrompts: [
      {
        num: 5,
        isChallenge: true,
        prompt: "こちら・そちら・どちらを使って文を書いてください。",
        promptEn: "Write a sentence using directional words: こちら, そちら, or どちら.",
        targets: [
          { surface: "こちら/そちら/どちら", reading: "こちら・そちら・どちら", meaning: "polite direction", matches: ["こちら", "そちら", "どちら", "あちら"], count: 1 },
        ],
        vocabPool: [
          { surface: "こちら", reading: "こちら", meaning: "this way" },
          { surface: "そちら", reading: "そちら", meaning: "that way" },
          { surface: "どちら", reading: "どちら", meaning: "which way" },
          { surface: "あちら", reading: "あちら", meaning: "over there" },
          { surface: "どうぞ", reading: "どうぞ", meaning: "please (go ahead)" },
        ],
        model: "こちらへどうぞ。",
      },
      {
        num: 6,
        isChallenge: true,
        prompt: "外食について書いてください。どこへ行きますか？",
        promptEn: "Write about eating out. Where are you going?",
        targets: [
          { surface: "外食", reading: "がいしょく", meaning: "eating out", matches: ["外食", "がいしょく"], count: 1 },
          { surface: "行きます", reading: "いきます", meaning: "go", matches: ["行きます", "行きました", "行きましょう", "いきます"], count: 1 },
        ],
        vocabPool: [
          { surface: "外食", reading: "がいしょく", meaning: "eating out" },
          { surface: "行きます", reading: "いきます", meaning: "will go" },
          { surface: "いっしょに", reading: "いっしょに", meaning: "together" },
          { surface: "今日", reading: "きょう", meaning: "today" },
        ],
        model: "今日、いっしょに外食をしましょう。",
      },
    ],
  },
};

// ─── Compose Screen router ────────────────────────────────────
function ComposeScreen() {
  const [view, setView]         = React.useState("menu"); // menu | compose
  const [activeId, setActiveId] = React.useState(null);

  const open = (id) => { setActiveId(id); setView("compose"); };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "var(--washi)", display: "flex", flexDirection: "column" }}>
      {view === "menu"    && <ComposeMenu onOpen={open} onClose={() => window.rikizoNav && window.rikizoNav("home")} />}
      {view === "compose" && <ComposeView id={activeId} onBack={() => setView("menu")} />}
    </div>
  );
}

// ─── Compose Menu ─────────────────────────────────────────────
function ComposeMenu({ onOpen, onClose }) {
  const lessons = window.RikizoCompose.lessons;

  const statusColor = (s) => s === "done" ? "var(--moss)" : s === "draft" ? "var(--indigo)" : s === "locked" ? "var(--ink-3)" : "var(--ink-3)";
  const statusLabel = (s) => ({ done: "Complete", draft: "Draft saved", new: "New", locked: "Locked" }[s] || "");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {/* Header */}
      <div style={{
        padding: "54px 20px 20px",
        background: "var(--ink)", color: "var(--washi)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", right: -20, top: -20,
          fontFamily: "var(--font-jp-display)", fontSize: 180,
          lineHeight: 0.85, fontWeight: 500,
          color: "oklch(0.97 0.008 80 / 0.05)", pointerEvents: "none",
        }}>作</div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={onClose} style={compBackBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--moss)", letterSpacing: "0.18em", fontWeight: 600 }}>COMPOSE · 作文</div>
            <h1 style={{ fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "4px 0 2px", lineHeight: 1.1, color: "var(--washi)" }}>さくぶん</h1>
            <div style={{ fontSize: 12.5, color: "oklch(0.97 0.008 80 / 0.6)" }}>Guided writing with target vocabulary.</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          marginTop: 18, display: "flex", gap: 1,
          background: "oklch(0.97 0.008 80 / 0.08)", borderRadius: "var(--r-md)", overflow: "hidden",
        }}>
          {[
            { label: "Total", val: lessons.length },
            { label: "Done",  val: lessons.filter(l => l.status === "done").length, color: "var(--moss)" },
            { label: "Draft", val: lessons.filter(l => l.status === "draft").length, color: "var(--indigo)" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "10px 6px", textAlign: "center", background: "oklch(0.97 0.008 80 / 0.04)" }}>
              <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: s.color || "var(--washi)", lineHeight: 1 }}>{s.val}</div>
              <div className="mono" style={{ fontSize: 9, color: "oklch(0.97 0.008 80 / 0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lesson list */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
        <MetaLabel>N5 · {lessons.length} compositions</MetaLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {lessons.map(l => {
            const locked = l.status === "locked";
            return (
              <button key={l.id} onClick={() => !locked && onOpen(l.id)} style={{
                textAlign: "left", padding: "14px 16px",
                borderRadius: "var(--r-lg)",
                background: "var(--washi)",
                border: `1px solid ${l.status === "done" ? "oklch(0.65 0.09 140 / 0.4)" : "var(--hairline)"}`,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.45 : 1,
                display: "flex", alignItems: "center", gap: 14,
                transition: "all 0.12s",
              }}>
                <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{l.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <span className="jp-serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{l.title}</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>{l.titleEn}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.theme}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {l.promptCount} prompts{l.challengeCount ? ` + ${l.challengeCount} challenge` : ""}
                    </div>
                    {l.status !== "new" && l.status !== "locked" && (
                      <div className="mono" style={{ fontSize: 9.5, color: statusColor(l.status), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                        · {statusLabel(l.status)}
                      </div>
                    )}
                  </div>
                </div>
                {!locked && (
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ color: "var(--ink-3)", flexShrink: 0 }}>
                    <path d="M1 1l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const compBackBtn = {
  width: 32, height: 32, borderRadius: 999, flexShrink: 0,
  border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--washi)",
};

Object.assign(window, { ComposeScreen, ComposeMenu, compBackBtn });
