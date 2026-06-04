/*
 * particle-sense.js — context-aware disambiguation for homograph particles.
 *
 * Several particle SURFACES carry more than one sense in shared/particles.json
 * (e.g. でも = sentence-initial "but/however" [p_demo_but] vs the noun-following
 * "even / any~" particle [p_demo]). Particles are intentionally left untagged in
 * story token data and resolved at render time by surface — but that lookup is
 * context-blind first-match-wins, so it always shows ONE sense regardless of how
 * the word is actually used.
 *
 * This module decides the correct sense from light context (sentence position +
 * neighbouring surfaces). Renderers call resolveParticleSense() before falling
 * back to the default surface lookup; the validate-particle-senses linter loads
 * this same file (single source of truth) to audit content + gate new mistakes.
 *
 * Browser: attaches to window.JPShared.particleSense. Node (linter): the file is
 * eval'd with a fake `window` (see scripts/validate-particle-senses.mjs).
 */
(function () {
  // Particle surfaces with >1 entry in shared/particles.json. Only でも has a
  // live rule today; the rest are declared so the linter flags them as
  // "unhandled hazards" (resolving blindly to first-match) until a rule lands.
  var HAZARDS = ['でも', 'と', 'から', 'が', 'の', 'か', 'では', 'そうだ'];

  // Surfaces that mark the end of the previous clause/sentence — a でも right
  // after one of these (or at the very start) is the conjunction, not the particle.
  var SENTENCE_ENDERS = ['。', '！', '？', '!', '?', '」', '』', '\n'];

  function atStart(ctx) {
    if (ctx.atSentenceStart) return true;
    return ctx.prevK != null && SENTENCE_ENDERS.indexOf(ctx.prevK) !== -1;
  }

  /**
   * Resolve a homograph particle surface to the correct glossary id for this
   * occurrence. Returns null for non-hazard surfaces or hazards without a rule
   * yet (caller keeps its default behaviour).
   * @param {string} surface  the token surface (token.k)
   * @param {{prevK?:string, nextK?:string, atSentenceStart?:boolean}} ctx
   * @returns {string|null} glossary/particle id, or null
   */
  var ENDER_RE = /[。！？!?]/;
  // Verb stems of saying / thinking that follow a quotative と (と言う・と思う…).
  var SAY_THINK_RE = /^[言思聞答話叫]/;
  // A plain/polite predicate ending (verb / i-adj / copula) preceding a particle.
  var PREDICATE_RE = /(です|ます|ました|でした|だった|ない|だ|た|る|い|う|く|す|ぬ|ぶ|む|つ|ぐ|ん)$/;

  function resolveParticleSense(surface, ctx) {
    ctx = ctx || {};
    var prevK = ctx.prevK || '', nextK = ctx.nextK || '';
    switch (surface) {
      case 'でも':
        // Sentence-initial → conjunction "but/however"; otherwise the "even /
        // any~" particle attaching to a preceding noun (強風でも; 何でも / いつでも).
        return atStart(ctx) ? 'p_demo_but' : 'p_demo';

      case 'と':
        // Quotative と after a closing quote (」と言いました) or before a verb of
        // saying/thinking (と思った). Otherwise the and/with connector (the
        // conditional sense isn't position-distinguishable; it defaults here).
        if (prevK === '」' || prevK === '』') return 'p_to_quote';
        if (SAY_THINK_RE.test(nextK)) return 'p_to_quote';
        return 'p_to';

      case 'から':
        // After a て-form → てから ("after doing"); after a predicate → reason
        // ("because"); after a noun → "from".
        if (/[てで]$/.test(prevK)) return 'p_tekara';
        if (PREDICATE_RE.test(prevK)) return 'p_kara_because';
        return 'p_kara';

      case 'が':
        // Contrastive "but" only when it clearly closes a predicate clause and a
        // new clause follows (〜ですが、). Everything else is the subject marker
        // (the dominant use — keep it as the safe default).
        if (nextK === '、' && PREDICATE_RE.test(prevK)) return 'p_ga_but';
        return 'p_ga';

      case 'の':
        // Sentence-final の is the casual question marker; otherwise possessive/of.
        return ENDER_RE.test(nextK) ? 'p_no_question' : 'p_no';

      case 'では':
        // Sentence-initial では = "well then"; otherwise the では topic/copula use.
        return (atStart(ctx) || prevK === '「') ? 'p_dewa_then' : 'p_dewa';

      case 'そうだ':
        // Attached to a plain predicate → hearsay (〜したそうだ); attached to a
        // stem → appearance (〜そうだ "looks like").
        return PREDICATE_RE.test(prevK) ? 'p_sou_da_hearsay' : 'p_sou_da';

      // か is left at its question default: the "or" sense (AかB) isn't reliably
      // distinguishable by adjacent surface alone. The linter still inventories it.
      default:
        return null;
    }
  }

  var RULED = ['でも', 'と', 'から', 'が', 'の', 'では', 'そうだ'];
  function isHazard(surface) { return HAZARDS.indexOf(surface) !== -1; }
  function hasRule(surface) { return RULED.indexOf(surface) !== -1; }

  var API = {
    resolveParticleSense: resolveParticleSense,
    isHazard: isHazard,
    hasRule: hasRule,
    HAZARDS: HAZARDS
  };

  if (typeof window !== 'undefined') {
    window.JPShared = window.JPShared || {};
    window.JPShared.particleSense = API;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})();
