// Stories — Part A: StoryScreen router + menu.

window.RikizoStories = {
  list: [
    {
      id: "ame-no-hi-no-gakkou",
      titleJp: "雨の日の学校",
      titleEn: "A Rainy Day at School",
      level: "N5",
      lessons: ["N5.11", "N5.12"],
      minutes: 5,
      status: "new",
      paragraphCount: 14,
    },
    {
      id: "kyuujitsu-no-rikizo",
      titleJp: "休日のりきぞ",
      titleEn: "Rikizo's Day Off",
      level: "N5",
      lessons: ["N5.7", "N5.8"],
      minutes: 4,
      status: "read",
    },
    {
      id: "kazoku-ga-kimasu",
      titleJp: "家族が来ます",
      titleEn: "Family is Coming",
      level: "N5",
      lessons: ["N5.1", "N5.2"],
      minutes: 4,
      status: "read",
    },
    {
      id: "restoran-to-kaimono",
      titleJp: "レストランと買い物",
      titleEn: "Restaurant and Shopping",
      level: "N5",
      lessons: ["N5.5", "N5.6"],
      minutes: 6,
      status: "new",
    },
    {
      id: "rikizo-to-ookii-sakana",
      titleJp: "りきぞと大きい魚",
      titleEn: "Rikizo and the Big Fish",
      level: "N5",
      lessons: ["N5.9", "N5.10"],
      minutes: 5,
      status: "locked",
    },
    {
      id: "tanjoubi-no-keeki",
      titleJp: "誕生日のケーキ",
      titleEn: "Birthday Cake",
      level: "N5",
      lessons: ["N5.13", "N5.14"],
      minutes: 5,
      status: "locked",
    },
    {
      id: "kita-minami-higashi-nishi",
      titleJp: "北・南・東・西",
      titleEn: "North, South, East, West",
      level: "N5",
      lessons: ["N5.15", "N5.16"],
      minutes: 6,
      status: "locked",
    },
    {
      id: "kaisha-de-no-arubaito",
      titleJp: "会社でのアルバイト",
      titleEn: "Part-time Work at the Company",
      level: "N5",
      lessons: ["N5.17", "N5.18"],
      minutes: 7,
      status: "locked",
    },
    {
      id: "yonde-kaite",
      titleJp: "読んで書いて",
      titleEn: "Reading and Writing",
      level: "N5",
      lessons: ["N5.19", "N5.20"],
      minutes: 6,
      status: "locked",
    },
    {
      id: "my-family",
      titleJp: "わたしのかぞく",
      titleEn: "My Family",
      level: "N5",
      lessons: ["N5.1"],
      minutes: 3,
      status: "read",
    },
  ],

  // Full story content for the demo (ame-no-hi-no-gakkou)
  activeStory: {
    id: "ame-no-hi-no-gakkou",
    titleJp: "雨の日の学校",
    titleEn: "A Rainy Day at School",
    level: "N5",
    lessons: ["N5.11", "N5.12"],
    minutes: 5,
    paragraphs: [
      { jp: "今日は雨です。天気はよくないです。", en: "Today it's raining. The weather isn't good." },
      { jp: "わたしの名前はりきぞです。日本人です。高校の学生です。", en: "My name is Rikizo. I'm Japanese. I'm a high school student." },
      { jp: "雨ですけど、学校へ行きました。学校の前にきれいな花がたくさんあります。雨の花はとてもきれいです。空気もいいですね。", en: "It's raining, but I went to school. There are beautiful flowers in front of the school. Flowers in the rain are very beautiful. The air is nice too." },
      { jp: "学校の中に小さい金魚がいます。金魚はかわいいです。", en: "Inside the school, there are small goldfish. The goldfish are cute." },
      { jp: "今日、クラスに新しい学生が来ました。外国人の学生です。名前はリーさんです。中国から日本に来ました。日本語を学びたいです。", en: "Today, a new student came to class. A foreign student. Their name is Lee. They came to Japan from China. They want to learn Japanese." },
      { jp: "リーさんは日本語の本とノートとペンを買いました。", en: "Lee bought a Japanese book, a notebook, and a pen." },
      { jp: "先生が来ました。「テストをしましょう。」「テストはつまらないですか。」「いいえ、おもしろいですよ。」テストはおもしろそうです。", en: "The teacher came. \"Let's do a test.\" \"Is the test boring?\" \"No, it's interesting!\" The test looks interesting." },
      { jp: "校長も来ました。「外国から来ましたか。学校が大すきですか。」「はい、大すきです。」", en: "The principal came too. \"You came from a foreign country? Do you love the school?\" \"Yes, I love it!\"" },
      { jp: "リーさんは小学校から日本語を学んでいます。高校の後で日本の大学に行きたいです。", en: "Lee has been learning Japanese since elementary school. After high school, they want to go to a Japanese university." },
      { jp: "わたしもいっしょに日本語を学びましょう。", en: "Let's learn Japanese together!" },
      { jp: "学校の後で、友だちとリーさんと外に行きました。空がきれいです。", en: "After school, we went outside with friends and Lee. The sky is beautiful." },
      { jp: "魚を食べました。おいしかったです。", en: "We ate fish. It was delicious." },
      { jp: "花火もありました。とてもきれいでした。今日はよかったです。また学校で学びましょう。", en: "There were fireworks too. They were very beautiful. Today was good. Let's learn at school again." },
    ],
    vocab: [
      { jp: "空", reading: "そら", meaning: "sky" },
      { jp: "雨", reading: "あめ", meaning: "rain" },
      { jp: "花", reading: "はな", meaning: "flower" },
      { jp: "魚", reading: "さかな", meaning: "fish" },
      { jp: "花火", reading: "はなび", meaning: "fireworks" },
      { jp: "金魚", reading: "きんぎょ", meaning: "goldfish" },
      { jp: "きれい", reading: "きれい", meaning: "beautiful / clean" },
      { jp: "学校", reading: "がっこう", meaning: "school" },
      { jp: "学生", reading: "がくせい", meaning: "student" },
      { jp: "高校", reading: "こうこう", meaning: "high school" },
      { jp: "外国人", reading: "がいこくじん", meaning: "foreigner" },
      { jp: "日本語", reading: "にほんご", meaning: "Japanese language" },
      { jp: "おもしろい", reading: "おもしろい", meaning: "interesting / funny" },
      { jp: "テスト", reading: "テスト", meaning: "test / exam" },
    ],
    grammar: [
      { pattern: "〜けど", meaning: "but / although (connector)" },
      { pattern: "〜たいです", meaning: "want to do" },
      { pattern: "〜ています", meaning: "is doing (progressive)" },
      { pattern: "〜ましょう", meaning: "let's do (invitation)" },
      { pattern: "おもしろそうです", meaning: "looks interesting (appearance)" },
    ],
  },
};

// ─── Story Screen router ──────────────────────────────────────
function StoryScreen() {
  const [view, setView]   = React.useState("menu");
  const [storyId, setStoryId] = React.useState(null);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {view === "menu"   && <StoryMenu onOpen={(id) => { setStoryId(id); setView("reader"); }} onClose={() => window.rikizoNav && window.rikizoNav("home")} />}
      {view === "reader" && <StoryReader id={storyId} onBack={() => setView("menu")} />}
    </div>
  );
}

// ─── Story Menu ───────────────────────────────────────────────
function StoryMenu({ onOpen, onClose }) {
  const stories = window.RikizoStories.list;
  const read    = stories.filter(s => s.status === "read").length;
  const total   = stories.length;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {/* Header */}
      <div style={{
        padding: "54px 20px 20px",
        background: "var(--ink)", color: "var(--washi)",
        position: "relative", overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", right: -20, top: -20,
          fontFamily: "var(--font-jp-display)", fontSize: 180,
          lineHeight: 0.85, fontWeight: 500,
          color: "oklch(0.97 0.008 80 / 0.05)", pointerEvents: "none",
        }}>語</div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={onClose} style={storyBackBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "0.18em", fontWeight: 600 }}>STORIES · 読みもの</div>
            <h1 style={{ fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "4px 0 2px", lineHeight: 1.1, color: "var(--washi)" }}>ものがたり</h1>
            <div style={{ fontSize: 12.5, color: "oklch(0.97 0.008 80 / 0.6)" }}>Read Japanese stories with in-line glossary.</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 16, display: "flex", gap: 1, background: "oklch(0.97 0.008 80 / 0.08)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          {[
            { label: "Stories",  val: total },
            { label: "Read",     val: read, color: "var(--gold)" },
            { label: "Unread",   val: total - read - stories.filter(s => s.status === "locked").length },
            { label: "Locked",   val: stories.filter(s => s.status === "locked").length, color: "var(--ink-3)" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "10px 6px", textAlign: "center", background: "oklch(0.97 0.008 80 / 0.04)" }}>
              <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600, color: s.color || "var(--washi)", lineHeight: 1 }}>{s.val}</div>
              <div className="mono" style={{ fontSize: 9, color: "oklch(0.97 0.008 80 / 0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Story list */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
        <MetaLabel>N5 · {total} stories</MetaLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {stories.map(s => {
            const locked = s.status === "locked";
            const isRead = s.status === "read";
            return (
              <button key={s.id} onClick={() => !locked && onOpen(s.id)} style={{
                textAlign: "left", padding: "14px 16px",
                borderRadius: "var(--r-lg)", background: "var(--washi)",
                border: `1px solid ${isRead ? "oklch(0.78 0.1 85 / 0.4)" : "var(--hairline)"}`,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.42 : 1,
                display: "flex", alignItems: "center", gap: 14,
                transition: "all 0.12s",
              }}>
                {/* Status indicator */}
                <div style={{
                  width: 44, height: 44, borderRadius: "var(--r-sm)", flexShrink: 0,
                  background: isRead ? "var(--gold)" : locked ? "var(--washi-3)" : "var(--ink)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isRead ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                  ) : locked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span className="jp-serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{s.titleJp}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 6 }}>{s.titleEn}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 9.5, color: isRead ? "var(--gold)" : "var(--indigo)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{s.level}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>~{s.minutes} min</span>
                    {s.lessons.map((l, i) => (
                      <span key={i} className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.08em" }}>{l}</span>
                    ))}
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

const storyBackBtn = {
  width: 32, height: 32, borderRadius: 999, flexShrink: 0,
  border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--washi)",
};

Object.assign(window, { StoryScreen, StoryMenu, storyBackBtn });
