// Lesson data mock — mirrors data/N5/lessons/N5.9.json shape.
window.RikizoLesson = {
  id: "N5.9",
  title: "Relative Position",
  jp: "いちのことば",
  focus: "Position words 前・後ろ・中・外",
  kanji: ["前", "後", "中", "外"],
  sectionsMeta: [
    { key: "intro",   label: "Opening",      jp: "はじめに", minutes: 1 },
    { key: "warmup",  label: "Warmup",       jp: "ウォームアップ", minutes: 3 },
    { key: "kanji",   label: "New Kanji",    jp: "あたらしいかんじ", minutes: 4 },
    { key: "vocab",   label: "Vocabulary",   jp: "ことば", minutes: 6 },
    { key: "convo",   label: "Conversation", jp: "かいわ", minutes: 5 },
    { key: "reading", label: "Reading",      jp: "どっかい", minutes: 4 },
    { key: "drill",   label: "Drill",        jp: "れんしゅう", minutes: 4 },
    { key: "close",   label: "Wrap",         jp: "まとめ", minutes: 1 },
  ],

  newKanji: [
    { k: "前", on: "ぜん",      kun: "まえ",     meaning: "Front · Before" },
    { k: "後", on: "ご/こう",   kun: "うしろ/あと", meaning: "Behind · After" },
    { k: "中", on: "ちゅう",    kun: "なか",     meaning: "Inside · Middle" },
    { k: "外", on: "がい",      kun: "そと",     meaning: "Outside" },
  ],

  vocab: [
    { group: "Position", items: [
      { jp: "前", reading: "まえ", en: "front, before" },
      { jp: "後ろ", reading: "うしろ", en: "behind" },
      { jp: "中", reading: "なか", en: "inside, middle" },
      { jp: "外", reading: "そと", en: "outside" },
    ]},
    { group: "Polite directions", items: [
      { jp: "こちら", reading: "こちら", en: "this way" },
      { jp: "そちら", reading: "そちら", en: "that way" },
      { jp: "あちら", reading: "あちら", en: "over there" },
      { jp: "どちら", reading: "どちら", en: "which way" },
    ]},
    { group: "Expressions", items: [
      { jp: "大丈夫", reading: "だいじょうぶ", en: "it's alright" },
      { jp: "どうして", reading: "どうして", en: "why" },
    ]},
  ],

  conversation: {
    title: "駅の前にあります",
    context: "Rikizo asks Yamakawa where the new store is.",
    lines: [
      { spk: "rikizo",   name: "Rikizo",   jp: "やまかわさん、店はどこにありますか。", en: "Yamakawa-san, where is the store?" },
      { spk: "yamakawa", name: "Yamakawa", jp: "駅の前にあります。",                    en: "It's in front of the station." },
      { spk: "rikizo",   name: "Rikizo",   jp: "店の中に何がありますか。",              en: "What's inside the store?" },
      { spk: "yamakawa", name: "Yamakawa", jp: "カレーやパンがあります。",              en: "There's curry and bread." },
      { spk: "rikizo",   name: "Rikizo",   jp: "外に車がありますか。",                  en: "Are there cars outside?" },
      { spk: "yamakawa", name: "Yamakawa", jp: "はい、駅の後ろにもありますよ。",         en: "Yes, behind the station too." },
    ],
  },

  readings: [
    {
      title: "駅の まわり",
      titleEn: "Around the Station",
      tag: "よむ 1",
      passage: [
        { jp: "駅の 前に 大きい 店が あります。", en: "There is a big store in front of the station." },
        { jp: "店の 中に カレーや パンが あります。", en: "Inside the store there is curry and bread." },
        { jp: "駅の 後ろに 車が あります。", en: "There are cars behind the station." },
        { jp: "外に 友だちが います。中に 先生が います。", en: "A friend is outside. The teacher is inside." },
        { jp: "りきぞは 外で コーヒーを 飲んでいます。", en: "Rikizo is drinking coffee outside." },
      ],
      questions: [
        { q: "駅の 前に 何が ありますか。", qEn: "What is in front of the station?", a: "大きい 店が あります。", aEn: "There is a big shop." },
        { q: "先生は どこに いますか。",    qEn: "Where is the teacher?",           a: "中に います。",         aEn: "The teacher is inside." },
        { q: "りきぞは 何を していますか。",  qEn: "What is Rikizo doing?",          a: "外で コーヒーを 飲んでいます。", aEn: "He is drinking coffee outside." },
      ],
    },
    {
      title: "外食に 行きました",
      titleEn: "I Went Out to Eat",
      tag: "よむ 2",
      passage: [
        { jp: "今日、やまかわは 外食に 行きました。", en: "Today, Yamakawa went out to eat." },
        { jp: "駅の 前に ある レストランへ 行きました。", en: "She went to the restaurant in front of the station." },
        { jp: "レストランの 中は しずかでした。", en: "Inside the restaurant was quiet." },
        { jp: "やまかわは カレーを 食べました。", en: "Yamakawa ate curry." },
        { jp: "食べた 後、店の 外で 友だちに 会いました。", en: "After eating, she met a friend outside the store." },
      ],
      questions: [
        { q: "やまかわは どこへ 行きましたか。", qEn: "Where did Yamakawa go?", a: "駅の 前の レストランへ 行きました。", aEn: "To the restaurant in front of the station." },
        { q: "レストランの 中は どうでしたか。", qEn: "How was it inside the restaurant?", a: "しずかでした。", aEn: "It was quiet." },
        { q: "食べた 後、どこで 友だちに 会いましたか。", qEn: "After eating, where did she meet a friend?", a: "店の 外で 会いました。", aEn: "Outside the store." },
      ],
    },
  ],

  drill: {
    prompt: "Fill the slot",
    en: "The store is __ the station.",
    before: "店は駅の",
    after: "にあります。",
    choices: ["前", "後ろ", "中", "外"],
    answer: "前",
    explain: "〜の前に = in front of ~",
  },
};

window.RikizoCharacters = {
  rikizo:   { portrait: "assets/characters/rikizo_head.png",   jp: "りきぞ" },
  yamakawa: { portrait: "assets/characters/rikizo_head.png",   jp: "やまかわ" }, /* no head file copied; reuse */
  sakura:   { portrait: "assets/characters/sakura_head.png",   jp: "さくら" },
  suzuki:   { portrait: "assets/characters/suzuki_head.png",   jp: "すずき先生" },
  ken:      { portrait: "assets/characters/ken_head.png",      jp: "けん" },
};
