// Grammar data — G9 subset, adapted from jp-lessons/data/N5/grammar/G9.json.
// Shape simplified for UI: each rule has pattern-chain, meaning, explanation,
// notes, 2–3 examples with colored parts.

window.RikizoGrammarIndex = [
  { id: "G1",  code: "G·01", title: "です / は / か",                  focus: "Basic identity & questions",           unlocksAfter: "N5.1",  status: "mastered" },
  { id: "G2",  code: "G·02", title: "これ・それ・あれ",                 focus: "Demonstratives",                         unlocksAfter: "N5.1",  status: "mastered" },
  { id: "G3",  code: "G·03", title: "の (possessive)",                  focus: "Connecting nouns",                       unlocksAfter: "N5.1",  status: "mastered" },
  { id: "G4",  code: "G·04", title: "Particles を・へ・に",              focus: "Directions & objects",                   unlocksAfter: "N5.2",  status: "practiced" },
  { id: "G5",  code: "G·05", title: "ました (past polite)",              focus: "Past actions",                           unlocksAfter: "N5.5",  status: "practiced" },
  { id: "G6",  code: "G·06", title: "い・な Adjectives",                 focus: "Describing things",                      unlocksAfter: "N5.5",  status: "practiced" },
  { id: "G7",  code: "G·07", title: "あります / います",                 focus: "Existence",                              unlocksAfter: "N5.5",  status: "practiced" },
  { id: "G8",  code: "G·08", title: "て-form foundations",               focus: "Connectives",                            unlocksAfter: "N5.5",  status: "new" },
  { id: "G9",  code: "G·09", title: "ている・たいです・ましょう",       focus: "Progressive, desire & invitation",       unlocksAfter: "N5.8",  status: "current" },
  { id: "G10", code: "G·10", title: "から・まで",                        focus: "From / until",                           unlocksAfter: "N5.9",  status: "locked" },
  { id: "G11", code: "G·11", title: "ながら (while)",                    focus: "Simultaneous actions",                   unlocksAfter: "N5.10", status: "locked" },
  { id: "G12", code: "G·12", title: "Conditional たら",                  focus: "If / when",                              unlocksAfter: "N5.11", status: "locked" },
];

// roles → accent colors (aligned to lesson tokens)
window.RikizoGrammarRoles = {
  verb:      { color: "var(--vermilion)", bg: "oklch(0.95 0.045 30)",  label: "verb"      },
  modifier:  { color: "var(--indigo)",    bg: "oklch(0.93 0.04 250)",   label: "modifier"  },
  predicate: { color: "var(--moss)",      bg: "oklch(0.94 0.04 140)",   label: "predicate" },
  topic:     { color: "var(--gold)",      bg: "oklch(0.95 0.055 85)",   label: "topic"     },
  object:    { color: "oklch(0.5 0.1 300)", bg: "oklch(0.94 0.04 300)", label: "object"    },
};

// G9 in full.
window.RikizoGrammar = {
  id: "G9",
  code: "G·09",
  title: "ている・たいです・ましょう",
  titleEn: "Progressive, Desire & Invitation",
  focus: "Three high-frequency patterns you'll use every day.",
  unlocksAfter: "N5.8",
  relatedLesson: { id: "N5.9", title: "Relative Position" },
  minutes: 35,
  summary: "Now that you know the て-form, you can unlock three of the most useful patterns in everyday Japanese: 'is doing', 'wants to do', and 'let's do'.",
  whyItMatters: "These three patterns transform Japanese from describing what happened to expressing what's happening, what you want, and inviting others to join.",

  rules: [
    {
      id: "teiru",
      label: "ている",
      meaning: "is doing · ongoing action or resultant state",
      tagline: "Progressive",
      pattern: [
        { label: "VERB",    role: "verb",      text: "食べる" },
        { label: "て-FORM", role: "modifier",  text: "食べて" },
        { label: "+ います", role: "predicate", text: "食べています" },
      ],
      explanation: "Combines the て-form with いる (います polite). Two uses: describing an action in progress, or a state that results from a completed action. Eating can be ongoing → progressive. 'Knowing' is a state → resultant state.",
      notes: [
        "て-form + いる (plain) / います (polite).",
        "Progressive: 食べています, 飲んでいます, 買っています.",
        "Resultant state: 知っています (knows), 住んでいます (lives).",
        "Negative: 食べていません / 食べていない.",
      ],
      examples: [
        {
          parts: [
            { text: "食べ",    role: "verb",      gloss: "eat (て-stem)" },
            { text: "て",      role: "predicate", gloss: "connector" },
            { text: "います",  role: "predicate", gloss: "is (polite)" },
          ],
          en: "is eating (right now)",
          breakdown: "食べる is ichidan: drop る → 食べ + て = 食べて. Then + います.",
        },
        {
          parts: [
            { text: "飲ん",    role: "verb",      gloss: "drink (て-stem)" },
            { text: "で",      role: "predicate", gloss: "voiced connector" },
            { text: "います",  role: "predicate", gloss: "is (polite)" },
          ],
          en: "is drinking (right now)",
          breakdown: "飲む is godan-む: む → んで. 飲む → 飲んで + います.",
        },
        {
          parts: [
            { text: "カレーを", role: "object",    gloss: "curry (object)" },
            { text: "食べ",     role: "verb",      gloss: "eat (て-stem)" },
            { text: "て",       role: "predicate", gloss: "connector" },
            { text: "います",   role: "predicate", gloss: "is" },
            { text: "か。",     role: "modifier",  gloss: "?" },
          ],
          en: "Are you eating curry right now?",
          breakdown: "Same formation, か appended to make a question.",
        },
      ],
    },
    {
      id: "tai",
      label: "たいです",
      meaning: "want to do · speaker's own desire",
      tagline: "Desire",
      pattern: [
        { label: "VERB",      role: "verb",      text: "買う" },
        { label: "ます-STEM", role: "modifier",  text: "買い" },
        { label: "+ たいです", role: "predicate", text: "買いたいです" },
      ],
      explanation: "Take the ます-stem (ます-form minus ます) and add たいです. Conjugates like an い-adjective: たくないです (don't want), たかったです (wanted). Expresses YOUR OWN desire.",
      notes: [
        "行く → 行き + たいです = 行きたいです.",
        "食べる → 食べ + たいです = 食べたいです.",
        "Negative: replace たいです with たくないです.",
        "Asking someone is fine: 食べたいですか？",
      ],
      examples: [
        {
          parts: [
            { text: "プレゼントを", role: "object",    gloss: "gift (object)" },
            { text: "買い",         role: "verb",      gloss: "buy (stem)" },
            { text: "たいです。",   role: "predicate", gloss: "want to" },
          ],
          en: "I want to buy a gift.",
          breakdown: "買う → 買い (stem) + たいです. を still marks the object.",
        },
        {
          parts: [
            { text: "デパートへ", role: "topic",     gloss: "to dept. store" },
            { text: "行き",       role: "verb",      gloss: "go (stem)" },
            { text: "たく",       role: "modifier",  gloss: "want (neg stem)" },
            { text: "ないです。", role: "predicate", gloss: "not" },
          ],
          en: "I don't want to go to the department store.",
          breakdown: "たい → たくない (like い-adj: たい → たく + ない).",
        },
        {
          parts: [
            { text: "何を",         role: "object",    gloss: "what (object)" },
            { text: "食べ",         role: "verb",      gloss: "eat (stem)" },
            { text: "たいですか。", role: "predicate", gloss: "want to?" },
          ],
          en: "What do you want to eat?",
          breakdown: "Questions with たいですか are natural.",
        },
      ],
    },
    {
      id: "tagaru",
      label: "たがる",
      meaning: "shows desire · another person's observable desire",
      tagline: "Others' desire",
      pattern: [
        { label: "VERB",      role: "verb",      text: "食べる" },
        { label: "ます-STEM", role: "modifier",  text: "食べ" },
        { label: "+ たがる",  role: "predicate", text: "食べたがる" },
      ],
      explanation: "You cannot claim what someone ELSE feels inside. Use たがる (observable behavior) for others. Conjugates as a godan verb; most commonly in progressive: たがっている = 'is showing they want to'.",
      notes: [
        "たい = speaker's own desire. たがる = observable desire in others.",
        "食べる → 食べ + たがる → 食べたがっています.",
        "Adjective version: こわがる, いやがる, ほしがる.",
        "OK to ask with たい: 食べたいですか？",
      ],
      examples: [
        {
          parts: [
            { text: "弟は",               role: "topic",     gloss: "my brother (topic)" },
            { text: "カレーを",           role: "object",    gloss: "curry (object)" },
            { text: "食べ",               role: "verb",      gloss: "eat (stem)" },
            { text: "たがっています。",   role: "predicate", gloss: "is showing desire to" },
          ],
          en: "My younger brother is showing he wants to eat curry.",
          breakdown: "食べ (stem) + たがる → たがっている (progressive).",
        },
        {
          parts: [
            { text: "友だちは",          role: "topic",     gloss: "my friend (topic)" },
            { text: "デパートへ",        role: "modifier",  gloss: "to dept. store" },
            { text: "行き",              role: "verb",      gloss: "go (stem)" },
            { text: "たがっています。",  role: "predicate", gloss: "is showing desire to" },
          ],
          en: "My friend is showing they want to go to the department store.",
          breakdown: "The friend's desire is observed from outside.",
        },
      ],
    },
    {
      id: "mashou",
      label: "ましょう",
      meaning: "let's do · polite invitation",
      tagline: "Invitation",
      pattern: [
        { label: "VERB",      role: "verb",      text: "食べる" },
        { label: "ます-STEM", role: "modifier",  text: "食べ" },
        { label: "+ ましょう", role: "predicate", text: "食べましょう" },
      ],
      explanation: "Replace ます with ましょう on the ます-stem. Invites the listener to do something together. Add か for a softer 'shall we?': ましょうか.",
      notes: [
        "行く → 行き + ましょう = 行きましょう.",
        "食べる → 食べ + ましょう = 食べましょう.",
        "ましょうか = 'shall we?' — gentler.",
        "Pair with いっしょに for natural invitations.",
      ],
      examples: [
        {
          parts: [
            { text: "いっしょに",   role: "modifier",  gloss: "together" },
            { text: "食べ",         role: "verb",      gloss: "eat (stem)" },
            { text: "ましょう。",   role: "predicate", gloss: "let's" },
          ],
          en: "Let's eat together.",
          breakdown: "食べる → 食べ (stem) + ましょう.",
        },
        {
          parts: [
            { text: "デパートへ",    role: "topic",     gloss: "to dept. store" },
            { text: "行き",          role: "verb",      gloss: "go (stem)" },
            { text: "ましょうか。",  role: "predicate", gloss: "shall we?" },
          ],
          en: "Shall we go to the department store?",
          breakdown: "か softens the invitation into a question.",
        },
      ],
    },
    {
      id: "deshou",
      label: "でしょう",
      meaning: "probably · conjecture about something uncertain",
      tagline: "Conjecture",
      pattern: [
        { label: "PLAIN",     role: "modifier",  text: "高い / 行く / プレゼント" },
        { label: "+ でしょう", role: "predicate", text: "高いでしょう / 行くでしょう / プレゼントでしょう" },
      ],
      explanation: "Used when you guess something is likely but aren't certain. Attaches to plain forms. For nouns and な-adjectives, don't insert だ. だろう is the casual equivalent.",
      notes: [
        "Noun: プレゼントでしょう. ✗ プレゼントだでしょう.",
        "い-adj plain form: 高いでしょう.",
        "Verb dictionary form: 行くでしょう.",
        "⚠️ でしょう ≠ ましょう (conjecture vs invitation).",
        "Rising intonation でしょう↑ = tag question.",
      ],
      examples: [
        {
          parts: [
            { text: "プレゼント",   role: "topic",     gloss: "gift" },
            { text: "でしょう。",   role: "predicate", gloss: "probably is" },
          ],
          en: "It's probably a gift.",
          breakdown: "Noun + でしょう. No だ inserted.",
        },
        {
          parts: [
            { text: "高い",          role: "modifier",  gloss: "expensive (plain)" },
            { text: "でしょう。",    role: "predicate", gloss: "probably" },
          ],
          en: "It's probably expensive.",
          breakdown: "い-adj plain form + でしょう.",
        },
        {
          parts: [
            { text: "デパートへ",   role: "modifier",  gloss: "to dept. store" },
            { text: "行く",          role: "verb",      gloss: "go (plain/dict)" },
            { text: "でしょう。",    role: "predicate", gloss: "probably" },
          ],
          en: "They will probably go to the department store.",
          breakdown: "Verb dictionary form (not ます-form) + でしょう.",
        },
      ],
    },
  ],

  comparison: {
    title: "たい vs たがる",
    subtitle: "My desire vs someone else's",
    tip: "たい = 'I feel it inside'. たがる = 'I can see it from outside'.",
    items: [
      {
        label: "たい",
        sub: "Speaker's own desire",
        role: "verb",
        points: [
          "Used for YOUR own feelings",
          "ます-stem + たいです (polite)",
          "Conjugates like an い-adjective (たくない, たかった)",
          "OK in questions: 食べたいですか？",
        ],
        example: {
          parts: [
            { text: "わたしは",     role: "topic",     gloss: "I (topic)" },
            { text: "カレーを",     role: "object",    gloss: "curry (object)" },
            { text: "食べ",         role: "verb",      gloss: "eat (stem)" },
            { text: "たいです。",   role: "predicate", gloss: "want to" },
          ],
          en: "I want to eat curry.",
        },
      },
      {
        label: "たがる",
        sub: "Others' observable desire",
        role: "modifier",
        points: [
          "Used for someone ELSE's observed desire",
          "ます-stem + たがる (godan U-verb)",
          "Most common in progressive: たがっている",
          "Can't claim others' inner feelings",
        ],
        example: {
          parts: [
            { text: "弟は",               role: "topic",     gloss: "brother (topic)" },
            { text: "カレーを",           role: "object",    gloss: "curry (object)" },
            { text: "食べ",               role: "verb",      gloss: "eat (stem)" },
            { text: "たがっています。",   role: "predicate", gloss: "is showing desire to" },
          ],
          en: "My brother is showing he wants to eat curry.",
        },
      },
    ],
  },

  table: {
    title: "All forms at a glance",
    description: "Using 行く (godan) and 食べる (ichidan).",
    headers: ["Pattern", "行く", "食べる", "Meaning"],
    rows: [
      { label: "ている",         cells: ["行っています",    "食べています",    "is going / is eating"] },
      { label: "ていません",     cells: ["行っていません",  "食べていません",  "is not going / eating"] },
      { label: "たいです",       cells: ["行きたいです",    "食べたいです",    "want to go / eat"] },
      { label: "たくないです",   cells: ["行きたくないです","食べたくないです","don't want to go / eat"] },
      { label: "ましょう",       cells: ["行きましょう",    "食べましょう",    "let's go / eat"] },
      { label: "ましょうか",     cells: ["行きましょうか",  "食べましょうか",  "shall we go / eat?"] },
    ],
  },

  quiz: [
    {
      q: "What does「食べています」mean?",
      choices: ["I am eating", "I ate", "Let's eat", "I want to eat"],
      answer: 0,
      explain: "ている = て-form + います. Expresses an ongoing action: 食べて + います = 'is eating'.",
    },
    {
      q: "Which sentence correctly means 'I want to buy a gift'?",
      choices: ["プレゼントを 買いたいです。", "プレゼントを 買いたいますです。", "プレゼントたいを 買います。", "プレゼントを 買います たい。"],
      answer: 0,
      explain: "たいです attaches to the ます-stem. 買う → 買い (stem) + たいです = 買いたいです.",
    },
    {
      q: "How do you say 'Let's eat at the restaurant'?",
      choices: ["レストランで 食べましょう。", "レストランで 食べます。", "レストランで 食べたいです。", "レストランで 食べています。"],
      answer: 0,
      explain: "ましょう attaches to the ます-stem. 食べる → 食べ + ましょう = 食べましょう.",
    },
    {
      q: "What does「コーヒーを 飲みたくないです」mean?",
      choices: ["I don't want to drink coffee.", "I am not drinking coffee.", "I did not drink coffee.", "Let's not drink coffee."],
      answer: 0,
      explain: "たくないです is the negative of たいです. たい conjugates like an い-adjective: たい → たく + ない.",
    },
    {
      q: "What is the correct ている form of「行く」?",
      choices: ["行っています", "行いています", "行きています", "行くています"],
      answer: 0,
      explain: "行く is a て-form exception: 行く → 行って (not 行いて). Then + います = 行っています.",
    },
    {
      q: "In「いっしょに 行きましょう」, what does ましょう express?",
      choices: ["A polite invitation to go together", "A past action of going", "A desire to go alone", "An ongoing action"],
      answer: 0,
      explain: "ましょう proposes a shared action. Adding か (行きましょうか) makes it a softer question: 'Shall we go?'",
    },
    {
      q: "What does「プレゼントでしょう」mean?",
      choices: ["It's probably a gift.", "Let's buy a gift.", "I want a gift.", "Is it a gift?"],
      answer: 0,
      explain: "でしょう attaches to a noun directly (no だ) to express polite conjecture: 'probably is'.",
    },
    {
      q: "Which correctly uses でしょう for 'They will probably go'?",
      choices: ["行くでしょう。", "行きましょう。", "行きますでしょう。", "行くだです。"],
      answer: 0,
      explain: "でしょう attaches to the plain (dictionary) form of the verb. 行く + でしょう = 行くでしょう.",
    },
  ],
};
