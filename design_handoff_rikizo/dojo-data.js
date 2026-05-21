// Dojo data — kanji from N5.9 + a few more for the flashcard demo.
window.RikizoDojo = {
  lessons: [
    { id: "N5.1",  title: "People & Family",  kanji: ["人","男","女","子","友","母","父","名","生","先"], status: "mastered" },
    { id: "N5.2",  title: "Days of the Week", kanji: ["日","月","火","水","木","金","土","毎","今","何"], status: "mastered" },
    { id: "N5.3",  title: "Numbers & Money",  kanji: ["一","二","三","四","五","六","七","八","九","十"], status: "mastered" },
    { id: "N5.4",  title: "Time & Calendar",  kanji: ["年","月","日","時","分","午","前","後","半","週"], status: "practiced" },
    { id: "N5.5",  title: "Places & Town",    kanji: ["町","村","国","店","駅","校","会","社","病","院"], status: "practiced" },
    { id: "N5.6",  title: "Nature",           kanji: ["山","川","田","林","森","花","草","空","海","池"], status: "practiced" },
    { id: "N5.7",  title: "Body & Health",    kanji: ["体","頭","手","足","目","口","耳","心","力","気"], status: "new" },
    { id: "N5.8",  title: "Food & Drink",     kanji: ["食","飲","米","魚","肉","野","菜","果","茶","酒"], status: "new" },
    { id: "N5.9",  title: "Relative Position",kanji: ["前","後","中","外","左","右","上","下","近","遠"], status: "current" },
  ],
  activeLessonIds: new Set(["N5.9"]),

  kanjiFlashcards: [
    { kanji: "前", reading: "まえ", on: "ぜん",   meaning: "front, before",   lesson: "N5.9" },
    { kanji: "後", reading: "うしろ", on: "ご",   meaning: "behind, after",   lesson: "N5.9" },
    { kanji: "中", reading: "なか",  on: "ちゅう",meaning: "inside, middle",  lesson: "N5.9" },
    { kanji: "外", reading: "そと",  on: "がい",  meaning: "outside",         lesson: "N5.9" },
    { kanji: "左", reading: "ひだり",on: "さ",    meaning: "left",            lesson: "N5.9" },
    { kanji: "右", reading: "みぎ",  on: "ゆう",  meaning: "right",           lesson: "N5.9" },
    { kanji: "上", reading: "うえ",  on: "じょう",meaning: "above, up",       lesson: "N5.9" },
    { kanji: "下", reading: "した",  on: "か",    meaning: "below, down",     lesson: "N5.9" },
  ],

  vocabFlashcards: [
    { word: "前", reading: "まえ", meaning: "front, before",   type: "noun", example: { jp: "駅の前にあります。", en: "It's in front of the station." } },
    { word: "後ろ", reading: "うしろ", meaning: "behind, back",  type: "noun", example: { jp: "駅の後ろに車があります。", en: "There are cars behind the station." } },
    { word: "中", reading: "なか", meaning: "inside, middle",    type: "noun", example: { jp: "店の中に何がありますか。", en: "What's inside the store?" } },
    { word: "外", reading: "そと", meaning: "outside",           type: "noun", example: { jp: "外でコーヒーを飲んでいます。", en: "Drinking coffee outside." } },
    { word: "こちら", reading: "こちら", meaning: "this way",    type: "direction", example: { jp: "こちらへどうぞ。", en: "This way, please." } },
    { word: "そちら", reading: "そちら", meaning: "that way",    type: "direction", example: { jp: "そちらはどこですか。", en: "Where is that way?" } },
    { word: "あちら", reading: "あちら", meaning: "over there",  type: "direction", example: { jp: "トイレはあちらです。", en: "The restroom is over there." } },
    { word: "どちら", reading: "どちら", meaning: "which way",   type: "direction", example: { jp: "どちらがいいですか。", en: "Which is better?" } },
    { word: "大丈夫", reading: "だいじょうぶ", meaning: "alright, OK", type: "na-adj", example: { jp: "大丈夫ですか。", en: "Are you alright?" } },
    { word: "外食", reading: "がいしょく", meaning: "eating out",  type: "noun", example: { jp: "今日、外食をしました。", en: "I ate out today." } },
  ],

  conjugationVerbs: [
    { surface: "食べる", reading: "たべる", meaning: "to eat",    verbClass: "ichidan", lesson_ids: "N5.1" },
    { surface: "飲む",   reading: "のむ",   meaning: "to drink",  verbClass: "godan",   lesson_ids: "N5.1" },
    { surface: "行く",   reading: "いく",   meaning: "to go",     verbClass: "godan",   lesson_ids: "N5.1" },
    { surface: "来る",   reading: "くる",   meaning: "to come",   verbClass: "irr_kuru",lesson_ids: "N5.1" },
    { surface: "する",   reading: "する",   meaning: "to do",     verbClass: "irr_suru",lesson_ids: "N5.1" },
    { surface: "見る",   reading: "みる",   meaning: "to see",    verbClass: "ichidan", lesson_ids: "N5.3" },
    { surface: "聞く",   reading: "きく",   meaning: "to listen", verbClass: "godan",   lesson_ids: "N5.3" },
    { surface: "書く",   reading: "かく",   meaning: "to write",  verbClass: "godan",   lesson_ids: "N5.3" },
    { surface: "買う",   reading: "かう",   meaning: "to buy",    verbClass: "godan",   lesson_ids: "N5.5" },
    { surface: "話す",   reading: "はなす", meaning: "to speak",  verbClass: "godan",   lesson_ids: "N5.5" },
    { surface: "帰る",   reading: "かえる", meaning: "to return", verbClass: "godan",   lesson_ids: "N5.5", falseIchidan: true },
    { surface: "起きる", reading: "おきる", meaning: "to wake up",verbClass: "ichidan", lesson_ids: "N5.7" },
    { surface: "寝る",   reading: "ねる",   meaning: "to sleep",  verbClass: "ichidan", lesson_ids: "N5.7" },
    { surface: "走る",   reading: "はしる", meaning: "to run",    verbClass: "godan",   lesson_ids: "N5.7", falseIchidan: true },
  ],

  conjugationForms: [
    { key: "polite_masu",       label: "Polite (〜ます)",         group: "Polite Verb Forms",   gLesson: "G7",
      rules: { godan: "u→iます", ichidan: "drop る + ます", irr_suru: "します", irr_kuru: "きます" } },
    { key: "polite_mashita",    label: "Polite Past (〜ました)",   group: "Polite Verb Forms",   gLesson: "G7",
      rules: { godan: "u→iました", ichidan: "drop る + ました" } },
    { key: "polite_negative",   label: "Polite Neg (〜ません)",    group: "Polite Verb Forms",   gLesson: "G7",
      rules: { godan: "u→iません", ichidan: "drop る + ません" } },
    { key: "te_form",           label: "〜て form",                group: "Te / Ta Forms",       gLesson: "G8",
      rules: { godan: "く→いて / む→んで / う/つ/る→って", ichidan: "drop る + て", irr_suru: "して", irr_kuru: "きて" } },
    { key: "plain_past",        label: "Plain Past (〜た)",        group: "Te / Ta Forms",       gLesson: "G8",
      rules: { godan: "same as て but with た", ichidan: "drop る + た" } },
    { key: "desire_tai",        label: "Want to (〜たいです)",     group: "Desire & Suggestions", gLesson: "G9",
      rules: { all: "masu-stem + たいです" } },
    { key: "polite_volitional_mashou", label: "Let's (〜ましょう)", group: "Desire & Suggestions", gLesson: "G9",
      rules: { all: "masu-stem + ましょう" } },
  ],

  stats: {
    kanji: 76, vocab: 142, verbs: 38, flagged: 12,
  },

  modes: [
    {
      category: "Kanji",
      accent: "var(--ink)",
      kanji: "字",
      items: [
        { key: "flash-kanji",     label: "Flashcards",       sub: "Flip & self-grade",         icon: "flip" },
        { key: "quiz-meaning",    label: "Kanji → Meaning",  sub: "Pick the English",          icon: "mcq" },
        { key: "quiz-meaning-r",  label: "Meaning → Kanji",  sub: "Reverse direction",         icon: "mcq-r" },
        { key: "quiz-reading",    label: "Kanji → Reading",  sub: "Pick the reading",          icon: "read" },
      ],
    },
    {
      category: "Vocab",
      accent: "var(--moss)",
      kanji: "語",
      items: [
        { key: "flash-vocab",     label: "Vocab Flashcards", sub: "Word + reading",            icon: "flip" },
        { key: "quiz-vocab",      label: "Vocab Quiz",       sub: "JP → English",              icon: "mcq" },
      ],
    },
    {
      category: "Verbs",
      accent: "var(--indigo)",
      kanji: "動",
      items: [
        { key: "dojo",            label: "Conjugation Dojo", sub: "Produce the correct form",  icon: "conj" },
      ],
    },
    {
      category: "Sentences",
      accent: "var(--vermilion)",
      kanji: "文",
      items: [
        { key: "scramble",        label: "Scramble",         sub: "Reassemble the sentence",   icon: "scramble" },
        { key: "link-sorted",     label: "Link Up: Sorted",  sub: "Sort into categories",      icon: "link" },
        { key: "link-hidden",     label: "Link Up: Hidden",  sub: "Guess the groups, 4 lives", icon: "link4" },
      ],
    },
    {
      category: "Flagged",
      accent: "oklch(0.6 0.15 50)",
      kanji: "旗",
      items: [
        { key: "flag-review",     label: "Review Flagged",   sub: "12 items need review",      icon: "flag" },
      ],
    },
  ],
};
