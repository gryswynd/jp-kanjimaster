/**
 * scripts/lib/conjugate.mjs
 *
 * ESM port of the conjugation engine in app/shared/text-processor.js.
 * Used at MIGRATION time to pre-generate inflected forms of verbs +
 * i-adjectives, so the tokenizer can match them as whole tappable chips
 * (うれしかった → one unit pointing to v_ureshii / plain_past_adj).
 *
 * Keep the rule-application logic in sync with the browser implementation
 * — both consume the same conjugation_rules.json.
 */

export const GODAN_MAPS = {
  u_to_i:    { 'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し', 'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り' },
  u_to_a:    { 'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ', 'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら' },
  u_to_e:    { 'う': 'え', 'く': 'け', 'ぐ': 'げ', 'す': 'せ', 'つ': 'て', 'ぬ': 'ね', 'ぶ': 'べ', 'む': 'め', 'る': 'れ' },
  u_to_o:    { 'う': 'お', 'く': 'こ', 'ぐ': 'ご', 'す': 'そ', 'つ': 'と', 'ぬ': 'の', 'ぶ': 'ぼ', 'む': 'も', 'る': 'ろ' },
  ta_form:   { 'う': 'った',  'つ': 'った',  'る': 'った',  'む': 'んだ',  'ぶ': 'んだ',  'ぬ': 'んだ',  'く': 'いた',  'ぐ': 'いだ',  'す': 'した'  },
  te_form:   { 'う': 'って',  'つ': 'って',  'る': 'って',  'む': 'んで',  'ぶ': 'んで',  'ぬ': 'んで',  'く': 'いて',  'ぐ': 'いで',  'す': 'して'  },
  tari_form: { 'う': 'ったり', 'つ': 'ったり', 'る': 'ったり', 'む': 'んだり', 'ぶ': 'んだり', 'ぬ': 'んだり', 'く': 'いたり', 'ぐ': 'いだり', 'す': 'したり' },
  tara_form: { 'う': 'ったら', 'つ': 'ったら', 'る': 'ったら', 'む': 'んだら', 'ぶ': 'んだら', 'ぬ': 'んだら', 'く': 'いたら', 'ぐ': 'いだら', 'す': 'したら' }
};

export function conjugate(term, ruleKey, conjugationRules) {
  if (!term || !conjugationRules) return null;
  const formDef = conjugationRules[ruleKey];
  if (!formDef || !formDef.rules) return null;

  let vClass = term.verb_class || term.gtype;
  // Normalize all the alias forms in use across glossary files.
  if (vClass === 'u')    vClass = 'godan';
  if (vClass === 'ru')   vClass = 'ichidan';
  if (vClass === 'verb') vClass = 'godan';
  if (['adjective', 'adjective_i', 'i-adj', 'i-adjective'].includes(vClass)) vClass = 'i_adj';
  if (['na-adjective', 'na-adj', 'adjective_na', 'na_adjective'].includes(vClass)) vClass = 'na_adj';
  if (vClass === 'irr_ii') vClass = 'irr_ii';   // いい has its own rule chain
  if (!vClass) vClass = 'godan';
  if (vClass === 'irr_iku' && !formDef.rules['irr_iku']) vClass = 'godan';

  const rule = formDef.rules[vClass];
  if (!rule) return null;

  let newSurface = term.surface;
  let newReading = term.reading || '';

  if (rule.type === 'replace') {
    newSurface = rule.surface;
    newReading = rule.reading;
    // Replace rules are used for irregular verbs (来る, 行く). They output
    // the full KANA conjugated form (こない, いって). When the original
    // term has a kanji-leading surface like 来る or 行く, the prose
    // typically writes the kanji form (来ない, 行って) — kana 来 → こ in
    // 来ない. Blend the kanji back in by replacing the leading kana of
    // the rule's surface with the original kanji prefix.
    var kanjiMatch = (term.surface || '').match(/^([一-鿿㐀-䶿]+)/);
    if (kanjiMatch && term.reading && term.surface.length > kanjiMatch[1].length) {
      var kanjiPrefix = kanjiMatch[1];
      var origKanaTail = term.surface.slice(kanjiPrefix.length);
      var origReadingPrefixLen = term.reading.length - origKanaTail.length;
      if (origReadingPrefixLen > 0 && newSurface.length > origReadingPrefixLen) {
        newSurface = kanjiPrefix + newSurface.slice(origReadingPrefixLen);
      }
    }

  } else if (rule.type === 'suffix') {
    if (rule.remove && newSurface.endsWith(rule.remove)) {
      newSurface = newSurface.slice(0, -rule.remove.length) + rule.add;
      newReading = newReading.slice(0, -rule.remove.length) + rule.add;
    } else {
      newSurface += rule.add;
      newReading += rule.add;
    }

  } else if (rule.type === 'godan_change') {
    const lastChar = newSurface.slice(-1);
    const map = GODAN_MAPS[rule.map];
    if (map && map[lastChar]) {
      newSurface = newSurface.slice(0, -1) + map[lastChar] + rule.add;
      newReading = newReading.slice(0, -1) + (map[newReading.slice(-1)] || newReading.slice(-1)) + rule.add;
    } else {
      return null;
    }

  } else if (rule.type === 'godan_euphonic') {
    const lastChar = newSurface.slice(-1);
    const lastReadingChar = newReading.slice(-1);
    const map = GODAN_MAPS[rule.map];
    if (map && map[lastChar]) {
      newSurface = newSurface.slice(0, -1) + map[lastChar] + (rule.add || '');
      newReading = newReading.slice(0, -1) + (map[lastReadingChar] || map[lastChar]) + (rule.add || '');
    } else {
      return null;
    }

  } else {
    return null;
  }

  return {
    ...term,
    id: term.id + '_' + ruleKey,
    surface: newSurface,
    reading: newReading,
    meaning: (term.meaning || '') + ' (' + (formDef.label || ruleKey) + ')',
    original_id: term.id,
    _ruleKey: ruleKey
  };
}

// Common conjugation forms we pre-generate for stories. Covers the most
// frequent verb/adj inflections seen in N5/N4 prose.
export const VERB_FORMS = [
  'polite_masu',
  'polite_mashita',
  'polite_negative',
  'polite_past_negative',
  'plain_past',
  'plain_negative',
  'plain_past_negative',
  'te_form',
  'plain_desire_tai',          // 行きたい "want to go" (plain)
  'desire_tai_negative',       // 行きたくない "don't want to go"
  'plain_desire_tai_past',     // 行きたかった "wanted to go" (plain)
  'polite_volitional_mashou',  // 学びましょう "let's study"
  'plain_volitional',          // 行こう "let's go" (plain)
  'potential',                 // 作れる "can make", 来られる "can come"
  'polite_potential',          // 学べます "can study", 作れます
  'potential_te',              // もらえて、できて "able to receive / do" (te-form)
  'plain_potential_negative',  // 作れない "can't make", 来られない
  'polite_potential_past',     // 作れました, 来られました
  'plain_potential_past',      // 売れた, 作れた "could sell / make" (plain past)
  'tari_form',                 // 入ったり、見たり "doing things like A, B..."
  'purpose_ni',                // 会いに、走りに (V-stem + に, pairs with 行く/来る)
  'nagara_form',               // 話しながら "while talking"
  'plain_potential_past_negative', // 売れなかった "couldn't sell"
  'conditional_ba',             // 読めば、書けば "if (one) reads / writes" (G25)
  'nakereba',                   // 読まなければ、書かなければ "if (one) doesn't ~" (G25)
  'conditional_tara',           // 読んだら、書いたら、来たら "when/if (one) read/wrote/came" (G25)
  'conditional_tara_negative',  // 読まなかったら、来なかったら "if (one) didn't ~" (G25)
  'passive',                    // 教えられる、書かれる "be taught / written" (G28)
  'passive_te',                 // 教えられて、書かれて
  'polite_passive_past',        // 教えられました、書かれました (G28)
  'plain_passive_past',         // 教えられた、書かれた (G28)
  'causative',                  // 習わせる、書かせる "make/let practice/write" (G29)
  'causative_te',               // 終わらせて、習わせて
  'plain_causative_past',       // 習わせた、書かせた (G29)
  'polite_causative_past',      // 習わせました、書かせました
  'causative_passive',                 // 習わせられる "was made to practice" (G29 long form)
  'plain_causative_passive_past',      // 習わせられた、書かせられた (G29 long form)
  'plain_short_causative_passive_past', // 習わされた、書かされた (G29 short form, common)
  'plain_short_causative_passive',     // 習わされる (short form non-past)
  'te_miru',                           // 食べてみる、行ってみる "try doing" (G30)
  'te_miru_past',                      // 食べてみた、行ってみた
  'te_oku',                            // 書いておく、読んでおく "do in advance" (G30)
  'te_oku_past',                       // 書いておいた
  'te_shimau',                         // 食べてしまう、来てしまう "end up doing" (G30)
  'te_shimau_past',                    // 食べてしまった、忘れてしまった
  'tosuru',                            // 食べようとする、行こうとする "be on the verge of" (G30)
  'sugiru_form',                       // 食べすぎる、書きすぎる "too much" (G30)
  'polite_sugiru_form'                 // 食べすぎます
];

// I-adj forms: skip the polite/polite_past variants because those just
// append です to the plain form. We want the chip to be the conjugation
// proper (うれしかった), and です to remain a separate tappable token.
export const I_ADJ_FORMS = [
  'plain_past_adj',
  'plain_negative',
  'plain_past_negative',
  'te_form',               // おおきくて "big and..." (i-adj te-form connector)
  'adverbial',             // 早く / 黒く (i-adj adverbial / ku-form)
  'appearance_sou_stem',   // おもしろそう "looks interesting" (plain stem)
  'appearance_sou',        // おもしろそうです "looks interesting" (polite)
  'plain_appearance_sou',  // おもしろそうだ "looks interesting" (plain)
  'polite_become_past',    // 大きくなりました "became big" (polite past)
  'polite_become',         // 大きくなります "becomes big" (polite)
  'plain_become_past',     // 大きくなった "became big" (plain past)
  'kutemo_form'            // 大きくても、きれいでも (G31 concessive)
];

export const NA_ADJ_FORMS = [
  'attributive_na'
];

// Copula forms — for the plain copula だ (g_da). Generates だった / じゃない /
// じゃなかった as single tappable chips so prose like "いい日だった" doesn't
// split as だ + った.
export const COPULA_FORMS = [
  'da_past',
  'da_negative',
  'da_past_negative'
];
