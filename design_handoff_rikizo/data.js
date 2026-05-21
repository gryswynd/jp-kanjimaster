// Mock state pulled from the real manifest + streak engine shape.
// This is what the home screen consumes.

window.RikizoData = {
  user: {
    name: "Rikizo",
    joinedDays: 47,
  },

  // Matches streak.js stages exactly
  streak: {
    current: 12,
    best: 23,
    freezes: 1,
    stage: { key: "week", jp: "いっしゅうかん", en: "Week Warrior", color: "#2196F3", belt: "belt-blue" },
    // Last 14 days — true = active
    history: [true, true, false, true, true, true, true, true, true, true, true, true, true, true],
  },

  // Overall N5 progress
  level: {
    id: "N5",
    title: "N5",
    subtitle: "Foundations",
    lessonsDone: 8,
    lessonsTotal: 20,
    kanjiDone: 76,
    kanjiTotal: 100,
  },

  // The "today" cell — computed from unlock.js + recency
  today: {
    type: "lesson",
    lessonId: "N5.9",
    title: "Weather & Seasons",
    jp: "てんきときせつ",
    minutes: 8,
    kanji: ["雨", "晴", "雪", "春", "夏", "秋", "冬", "風", "空", "気"],
    newTerms: 14,
    accentKanji: "天",
  },

  // Continues — lesson in progress
  resume: {
    type: "grammar",
    id: "G9",
    title: "〜てform",
    subtitle: "Connecting actions",
    progress: 0.4,
  },

  // Module cards (matches unlock.js modules)
  modules: [
    { key: "lesson",   label: "Lessons",  jp: "レッスン",   kanji: "本", unlocked: true,  streak: 8,  accent: "ink" },
    { key: "grammar",  label: "Grammar",  jp: "ぶんぽう",   kanji: "文", unlocked: true,  streak: 3,  accent: "moss" },
    { key: "practice", label: "Dojo",     jp: "どうじょう", kanji: "道", unlocked: true,  streak: 11, accent: "vermilion" },
    { key: "compose",  label: "Compose",  jp: "さくぶん",   kanji: "作", unlocked: true,  streak: 0,  accent: "indigo" },
    { key: "story",    label: "Stories",  jp: "ものがたり", kanji: "語", unlocked: true,  streak: 2,  accent: "gold" },
    { key: "review",   label: "Review",   jp: "ふくしゅう", kanji: "習", unlocked: true,  streak: 1,  accent: "ink" },
    { key: "game",     label: "Adventure",jp: "ぼうけん",   kanji: "険", unlocked: true,  streak: 0,  accent: "vermilion" },
  ],

  // Character cast — used decoratively on the home screen.
  // Heads are small sprite-y portraits.
  cast: [
    { id: "rikizo",   name: "Rikizo",   jp: "りきぞ",   portrait: "assets/characters/rikizo_head.png",   seen: true  },
    { id: "sakura",   name: "Sakura",  jp: "さくら",   portrait: "assets/characters/sakura_head.png",   seen: true  },
    { id: "suzuki",   name: "Suzuki",  jp: "すずき先生", portrait: "assets/characters/suzuki_head.png",   seen: true  },
    { id: "ken",      name: "Ken",     jp: "けん",      portrait: "assets/characters/ken_head.png",      seen: true  },
    { id: "miki",     name: "Miki",    jp: "ミキ",     portrait: "assets/characters/miki_head.png",     seen: false },
    { id: "yuki",     name: "Yuki",    jp: "ゆき",     portrait: "assets/characters/yuki_head.png",     seen: true  },
    { id: "yamamoto", name: "Yamamoto",jp: "やまもと先生", portrait: "assets/characters/yamamoto_head.png", seen: false },
  ],

  // Current chapter / arc — gives the home screen narrative
  arc: {
    number: 3,
    title: "Seasons in Tsukihara",
    jp: "月原のきせつ",
    progressPct: 0.42,
  },

  // Small daily challenge — below the fold
  challenge: {
    title: "Kanji of the day",
    kanji: "雨",
    reading: "あめ",
    meaning: "rain",
    prompt: "Write a sentence using 雨.",
  },
};
