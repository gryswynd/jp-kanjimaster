// Review module — Part A: Screen router + menu + mock data.

window.RikizoReviews = {
  list: [
    { id: "N5.Review.1", title: "People, Family & Days",     lessons: "N5.1–2",  questions: 12, topScore: 92, status: "passed" },
    { id: "N5.Review.2", title: "Numbers, Time & Places",    lessons: "N5.3–4",  questions: 14, topScore: 78, status: "passed" },
    { id: "N5.Review.3", title: "Nature & Body",             lessons: "N5.5–6",  questions: 13, topScore: 65, status: "passed" },
    { id: "N5.Review.4", title: "Food, Transport & Adjectives", lessons: "N5.7–8", questions: 15, topScore: null, status: "new" },
    { id: "N5.Review.5", title: "Position & Weather",        lessons: "N5.9–10", questions: 14, topScore: null, status: "new" },
    { id: "N5.Review.6", title: "School & Nature",           lessons: "N5.11–12",questions: 16, topScore: null, status: "locked" },
    { id: "N5.Review.7", title: "Work & Travel",             lessons: "N5.13–14",questions: 15, topScore: null, status: "locked" },
    { id: "N5.Review.8", title: "Actions & States",          lessons: "N5.15–16",questions: 14, topScore: null, status: "locked" },
    { id: "N5.Review.9", title: "N5 Final Review",           lessons: "N5.1–20", questions: 30, topScore: null, status: "locked", isFinal: true },
  ],

  // Demo review content — mirrors N5.Review.1 structure
  activeReview: {
    id: "N5.Review.1",
    title: "People, Family & Days of the Week",
    focus: "Review of Kanji, Vocabulary, and Grammar from Lessons N5.1–2.",
    lessons: "N5.1–2",
    sections: [
      { title: "Part 1 · Conversation", questions: 3 },
      { title: "Part 2 · Vocabulary",   questions: 4 },
      { title: "Part 3 · Scramble",     questions: 3 },
      { title: "Part 4 · Reading",      questions: 3 },
    ],
    questions: [
      // ── MCQ ──────────────────────────────────────────────────
      {
        type: "mcq", section: "Part 1 · Conversation", num: 1,
        passage: [
          { spk: "りきぞ", jp: "おはようございます。今日は何曜日ですか。" },
          { spk: "さくら", jp: "今日は月曜日ですよ。" },
          { spk: "りきぞ", jp: "月曜日ですか。授業がありますね。" },
        ],
        q: "今日は何曜日ですか。",
        qEn: "What day is it today?",
        choices: ["日曜日", "月曜日", "火曜日", "水曜日"],
        answer: "月曜日",
        explain: "さくらさんが「今日は月曜日ですよ」と言いました。",
      },
      {
        type: "mcq", section: "Part 1 · Conversation", num: 2,
        passage: [
          { spk: "りきぞ", jp: "先生の名前は何ですか。" },
          { spk: "すずき", jp: "わたしの名前はすずきです。どうぞよろしく。" },
        ],
        q: "先生の名前は何ですか。",
        qEn: "What is the teacher's name?",
        choices: ["りきぞ", "やまもと", "すずき", "さくら"],
        answer: "すずき",
        explain: "先生が「わたしの名前はすずきです」と言いました。",
      },
      {
        type: "mcq", section: "Part 1 · Conversation", num: 3,
        passage: [
          { spk: "やまかわ", jp: "今日、学校は休みですか。" },
          { spk: "りきぞ",   jp: "いいえ、土曜日は学校がありますよ。" },
        ],
        q: "今日は何曜日ですか。",
        qEn: "What day is today?",
        choices: ["金曜日", "土曜日", "日曜日", "月曜日"],
        answer: "土曜日",
        explain: "りきぞが「土曜日は学校がありますよ」と言いました。",
      },
      // ── MCQ vocab ────────────────────────────────────────────
      {
        type: "mcq", section: "Part 2 · Vocabulary", num: 4,
        q: "「父」の読み方はどれですか。",
        qEn: "How do you read 父?",
        choices: ["はは", "ちち", "あに", "あね"],
        answer: "ちち",
        explain: "父 (ちち) = father. 母 (はは) = mother, 兄 (あに) = older brother.",
      },
      {
        type: "mcq", section: "Part 2 · Vocabulary", num: 5,
        q: "「友だち」の意味はどれですか。",
        qEn: "What does 友だち mean?",
        choices: ["teacher", "student", "friend", "family"],
        answer: "friend",
        explain: "友だち (ともだち) = friend. 先生 = teacher, 学生 = student.",
      },
      {
        type: "mcq", section: "Part 2 · Vocabulary", num: 6,
        q: "Which sentence correctly says 'My name is Rikizo'?",
        qEn: "",
        choices: [
          "わたしは りきぞです。",
          "りきぞは わたしです。",
          "わたしの 名前は りきぞです。",
          "りきぞの 名前は わたしです。",
        ],
        answer: "わたしの 名前は りきぞです。",
        explain: "わたしの名前は〜です is the standard pattern for introducing your name.",
      },
      {
        type: "mcq", section: "Part 2 · Vocabulary", num: 7,
        q: "「毎日」の意味はどれですか。",
        qEn: "What does 毎日 mean?",
        choices: ["every day", "every week", "today", "tomorrow"],
        answer: "every day",
        explain: "毎日 (まいにち) = every day. 毎週 = every week, 今日 = today.",
      },
      // ── Scramble ─────────────────────────────────────────────
      {
        type: "scramble", section: "Part 3 · Scramble", num: 8,
        instruction: "Arrange the words to form a correct sentence.",
        qEn: "My mother is a teacher.",
        segments: ["わたしの", "母は", "先生です。"],
        distractors: ["父は", "学生です。"],
        answer: "わたしの母は先生です。",
      },
      {
        type: "scramble", section: "Part 3 · Scramble", num: 9,
        instruction: "Arrange the words to form a correct sentence.",
        qEn: "Today is Wednesday.",
        segments: ["今日は", "水曜日", "です。"],
        distractors: ["木曜日", "ありますよ。"],
        answer: "今日は水曜日です。",
      },
      {
        type: "scramble", section: "Part 3 · Scramble", num: 10,
        instruction: "Arrange the words to form a correct sentence.",
        qEn: "My friend's name is Yamakawa.",
        segments: ["友だちの", "名前は", "やまかわです。"],
        distractors: ["先生の", "学生の"],
        answer: "友だちの名前はやまかわです。",
      },
      // ── Reading MCQ ──────────────────────────────────────────
      {
        type: "reading", section: "Part 4 · Reading", num: 11,
        passage: [
          "わたしの名前はりきぞです。",
          "毎日、学校へ行きます。",
          "月曜日から金曜日まで学校があります。",
          "友だちの名前はやまかわです。",
          "やまかわさんは男の子です。",
        ],
        q: "りきぞは何曜日に学校がありますか。",
        qEn: "On which days does Rikizo have school?",
        choices: ["月曜日だけ", "月曜日から金曜日まで", "毎日", "土曜日と日曜日"],
        answer: "月曜日から金曜日まで",
        explain: "「月曜日から金曜日まで学校があります」と書いてあります。",
      },
      {
        type: "reading", section: "Part 4 · Reading", num: 12,
        passage: null, // uses previous passage
        q: "やまかわさんは男の子ですか、女の子ですか。",
        qEn: "Is Yamakawa a boy or a girl?",
        choices: ["男の子", "女の子", "先生", "わからない"],
        answer: "男の子",
        explain: "「やまかわさんは男の子です」と書いてあります。",
      },
    ],
  },
};

// ─── Review Screen router ─────────────────────────────────────
function ReviewScreen() {
  const [view, setView]     = React.useState("menu");
  const [reviewId, setReviewId] = React.useState(null);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", background: "var(--washi)" }}>
      {view === "menu"   && <ReviewMenu onStart={(id) => { setReviewId(id); setView("quiz"); }} onClose={() => window.rikizoNav && window.rikizoNav("home")} />}
      {view === "quiz"   && <ReviewQuiz id={reviewId} onBack={() => setView("menu")} />}
    </div>
  );
}

// ─── Review Menu ──────────────────────────────────────────────
function ReviewMenu({ onStart, onClose }) {
  const reviews = window.RikizoReviews.list;
  const passed  = reviews.filter(r => r.status === "passed").length;

  const gradeColor = (score) => {
    if (!score) return "var(--ink-3)";
    if (score >= 90) return "var(--moss)";
    if (score >= 75) return "var(--indigo)";
    if (score >= 60) return "var(--gold)";
    return "var(--vermilion)";
  };

  const grade = (score) => {
    if (!score) return null;
    if (score >= 95) return "S";
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    return "D";
  };

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
        }}>習</div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={onClose} style={reviewBackBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--vermilion)", letterSpacing: "0.18em", fontWeight: 600 }}>REVIEW · ふくしゅう</div>
            <h1 style={{ fontFamily: "var(--font-jp-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "4px 0 2px", lineHeight: 1.1, color: "var(--washi)" }}>ふくしゅう</h1>
            <div style={{ fontSize: 12.5, color: "oklch(0.97 0.008 80 / 0.6)" }}>Timed assessments with scoring and feedback.</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 16, display: "flex", gap: 1, background: "oklch(0.97 0.008 80 / 0.08)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          {[
            { label: "Reviews",  val: reviews.filter(r => r.status !== "locked").length },
            { label: "Passed",   val: passed, color: "var(--moss)" },
            { label: "Avg score",val: passed ? Math.round(reviews.filter(r => r.topScore).reduce((s,r) => s + r.topScore, 0) / passed) + "%" : "—", color: "var(--vermilion)" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "10px 6px", textAlign: "center", background: "oklch(0.97 0.008 80 / 0.04)" }}>
              <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 22, fontWeight: 600, color: s.color || "var(--washi)", lineHeight: 1 }}>{s.val}</div>
              <div className="mono" style={{ fontSize: 9, color: "oklch(0.97 0.008 80 / 0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px" }}>
        <MetaLabel>N5 · {reviews.length} reviews</MetaLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {reviews.map(r => {
            const locked = r.status === "locked";
            const g = grade(r.topScore);
            const gc = gradeColor(r.topScore);
            return (
              <button key={r.id} onClick={() => !locked && onStart(r.id)} style={{
                textAlign: "left", padding: "14px 16px",
                borderRadius: "var(--r-lg)", background: "var(--washi)",
                border: `1px solid ${r.isFinal ? "oklch(0.6 0.18 30 / 0.35)" : r.status === "passed" ? "oklch(0.65 0.09 140 / 0.3)" : "var(--hairline)"}`,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.42 : 1,
                display: "flex", alignItems: "center", gap: 14,
                transition: "all 0.12s",
              }}>
                {/* Score / status badge */}
                <div style={{
                  width: 48, height: 48, borderRadius: "var(--r-sm)", flexShrink: 0,
                  background: r.topScore ? gc : locked ? "var(--washi-3)" : "var(--ink)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 1,
                }}>
                  {g ? (
                    <>
                      <div style={{ fontFamily: "var(--font-jp-display)", fontSize: 20, fontWeight: 700, color: "var(--washi)", lineHeight: 1 }}>{g}</div>
                      <div className="mono" style={{ fontSize: 8, color: "oklch(0.97 0.008 80 / 0.7)", letterSpacing: "0.06em" }}>{r.topScore}%</div>
                    </>
                  ) : locked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{r.title}</span>
                    {r.isFinal && <span className="mono" style={{ fontSize: 9.5, color: "var(--vermilion)", fontWeight: 700, letterSpacing: "0.1em" }}>FINAL</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {r.lessons} · {r.questions} questions
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

const reviewBackBtn = {
  width: 32, height: 32, borderRadius: 999, flexShrink: 0,
  border: "1px solid oklch(0.97 0.008 80 / 0.2)", background: "transparent",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--washi)",
};

Object.assign(window, { ReviewScreen, ReviewMenu, reviewBackBtn });
