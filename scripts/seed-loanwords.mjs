#!/usr/bin/env node
/**
 * scripts/seed-loanwords.mjs
 * Authoring tool for the loanword (gairaigo) corpus. Holds per-genre batches of
 * authored loanwords and MERGES them into shared/loanwords.json by id
 * (idempotent — re-running never duplicates; existing entries are left as-is so
 * hand-tuned origins/themes survive).
 *
 * After running:  node scripts/derive-glossary-tokens.mjs   (bakes tokens)
 *
 * Entry shape: { id, surface(katakana), reading(hiragana), meaning, origin,
 *                themes:[...], tier? }. ids use the `lw_` prefix to stay clear
 * of the migrated `v_*` ids.
 *
 * Run:  node scripts/seed-loanwords.mjs            (all batches)
 *       node scripts/seed-loanwords.mjs --only=sci-fi
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = 'shared/loanwords.json';

// Shorthands for origin keys (must exist in shared/loanword-origins.json).
const EN = 'American English', BR = 'British English', PT = 'Portuguese',
  DE = 'German', FR = 'French', NL = 'Dutch', IT = 'Italian', LA = 'Latin',
  GR = 'Greek', CN = 'Chinese', NO = 'Norwegian', SA = 'Sanskrit', ES = 'Spanish',
  RU = 'Russian', AR = 'Arabic';

// RETAG: add an extra theme to EXISTING pool entries (e.g. the migrated v_* foods)
// without recreating them. Applied every run; idempotent (themes are deduped).
const RETAG = {
  // migrated foods/drinks → also surface under the Food theme
  v_keeki: ['food', 'events'], v_karee: ['food'], v_koohii: ['food', 'drinks'], v_pan: ['food'],
  v_juusu: ['food', 'drinks'], v_sarada: ['food'], v_chokoreeto: ['food'], v_piza: ['food'],
  v_sandoicchi: ['food'], v_aisukuriimu: ['food'], v_purin: ['food'],
  // migrated travel words → Travel theme
  v_hoteru: ['travel'], v_takushii: ['travel'], v_basu: ['travel'], lw_gaido: ['travel'],
  lw_gooru: ['sports'],   // goal → also Sports
  v_konsaato: ['music'],  // concert → also Music
  // workplace cross-overs → also Business
  lw_sukejuuru: ['business'], lw_puran: ['business'], lw_shisutemu: ['business'],
  lw_chiimu: ['business'], v_saabisu: ['business'], v_purezenteshon: ['business'],
  // health cross-overs
  lw_masuku: ['health'], lw_karorii: ['health'],
  lw_uirusu: ['health', 'science'],   // virus → health + science
  // science cross-overs
  lw_enerugii: ['science'], lw_gasu: ['science'], lw_deeta: ['science'],
  // cooking ∩ food overlaps (per "theme overlaps allowed")
  lw_boiru: ['food'], lw_katto: ['food'], lw_mikkusu: ['food'], lw_toppingu: ['food'],
  lw_oodaa: ['food'], lw_menyuu: ['cooking'], lw_reshipi: ['cooking'], lw_dezaato: ['cooking'],
  // entertainment cross-overs
  v_terebi: ['entertainment'], v_geemu: ['entertainment'], lw_komedi: ['entertainment'],
  lw_raibu: ['entertainment'], lw_chiketto: ['entertainment'],
  // romance + events cross-overs
  v_purezento: ['romance', 'events'], lw_sapuraizu: ['romance', 'events'],
  // fashion cross-overs (existing clothing → Fashion; some also period-piece)
  lw_botan: ['fashion'], lw_ringu: ['fashion'], lw_saizu: ['fashion'],
  lw_suutsu: ['fashion'], v_shatsu: ['fashion'],
  lw_doresu: ['fashion', 'period-piece'],
  lw_kooto: ['period-piece'], lw_nekutai: ['period-piece'],
  // emotions cross-overs
  lw_tenshon: ['emotions'], lw_sutoresu: ['emotions'], lw_rirakkusu: ['emotions'],
  lw_panikku: ['emotions'], lw_shokku: ['emotions'],
  // existing beverages → Drinks theme (v_koohii/v_juusu handled in the food block)
  lw_biiru: ['drinks'], lw_wain: ['drinks'], lw_kakuteru: ['drinks'],
  lw_arukooru: ['science', 'drinks'],
  // tier-3 cross-overs
  lw_kaosu: ['mythology'], lw_janguru: ['animals'],
  // household / vehicles / colors / campus cross-overs
  v_teeburu: ['household'], v_beddo: ['household'], v_toire: ['household'], lw_suicchi: ['household'],
  lw_enjin: ['vehicles'], lw_herikoputaa: ['vehicles'], lw_booto: ['vehicles'], lw_rentakaa: ['vehicles'],
  lw_barentain: ['events'],
  v_tesuto: ['school'], v_nooto: ['school', 'stationery'], v_kurasu_class: ['school'], lw_repooto: ['school'],
  v_pen: ['stationery'], lw_fairu: ['stationery'], lw_kaado: ['shopping'],
  v_geemu: ['games'], lw_kuizu: ['games'],
};

// ── Genre batches ────────────────────────────────────────────────────────────
// `c` marks a high-frequency everyday word (tier:'common'); such words also get
// 'slice-of-life' added to their themes so the Common filter stays coherent.
const BATCHES = {
  'sci-fi': [
    ['lw_robotto', 'ロボット', 'ろぼっと', 'robot', EN],
    ['lw_roketto', 'ロケット', 'ろけっと', 'rocket', EN],
    ['lw_reezaa', 'レーザー', 'れーざー', 'laser', EN],
    ['lw_konpyuutaa', 'コンピューター', 'こんぴゅーたー', 'computer', EN, 'c'],
    ['lw_deeta', 'データ', 'でーた', 'data', EN, 'c'],
    ['lw_shisutemu', 'システム', 'しすてむ', 'system', EN, 'c'],
    ['lw_enerugii', 'エネルギー', 'えねるぎー', 'energy', DE],
    ['lw_enjin', 'エンジン', 'えんじん', 'engine', EN, 'c'],
    ['lw_suicchi', 'スイッチ', 'すいっち', 'switch', EN, 'c'],
    ['lw_botan', 'ボタン', 'ぼたん', 'button', PT, 'c'],
    ['lw_garasu', 'ガラス', 'がらす', 'glass', NL, 'c'],
    ['lw_gasu', 'ガス', 'がす', 'gas', NL, 'c'],
    ['lw_reedaa', 'レーダー', 'れーだー', 'radar', EN],
    ['lw_misairu', 'ミサイル', 'みさいる', 'missile', EN],
    ['lw_biimu', 'ビーム', 'びーむ', 'beam (of energy)', EN],
    ['lw_baria', 'バリア', 'ばりあ', 'barrier / force field', EN],
    ['lw_waapu', 'ワープ', 'わーぷ', 'warp (jump in space)', EN],
    ['lw_taimumashin', 'タイムマシン', 'たいむましん', 'time machine', EN],
    ['lw_andoroido', 'アンドロイド', 'あんどろいど', 'android', EN],
    ['lw_saiboogu', 'サイボーグ', 'さいぼーぐ', 'cyborg', EN],
    ['lw_monitaa', 'モニター', 'もにたー', 'monitor / screen', EN, 'c'],
    ['lw_keeburu', 'ケーブル', 'けーぶる', 'cable', EN, 'c'],
    ['lw_puroguramu', 'プログラム', 'ぷろぐらむ', 'program', EN, 'c'],
    ['lw_nettowaaku', 'ネットワーク', 'ねっとわーく', 'network', EN, 'c'],
    ['lw_sensaa', 'センサー', 'せんさー', 'sensor', EN],
    ['lw_batterii', 'バッテリー', 'ばってりー', 'battery', EN, 'c'],
    ['lw_paneru', 'パネル', 'ぱねる', 'panel', EN],
    ['lw_kapuseru', 'カプセル', 'かぷせる', 'capsule', EN],
    ['lw_meetaa', 'メーター', 'めーたー', 'meter / gauge', EN, 'c'],
    ['lw_herikoputaa', 'ヘリコプター', 'へりこぷたー', 'helicopter', EN],
    ['lw_sukuriin', 'スクリーン', 'すくりーん', 'screen', EN],
    ['lw_uirusu', 'ウイルス', 'ういるす', 'virus', LA],
    ['lw_meka', 'メカ', 'めか', 'mecha / machinery', EN],
    ['lw_rebaa', 'レバー', 'ればー', 'lever', EN],
  ],

  // Curated to genuinely katakana-DOMINANT terms only — dropped stopgaps where a
  // native word is the real form (ドラゴン→竜, マジック→魔法, ソード→剣, etc.).
  'fantasy': [
    ['lw_erufu', 'エルフ', 'えるふ', 'elf', EN],
    ['lw_dowaafu', 'ドワーフ', 'どわーふ', 'dwarf', EN],
    ['lw_goburin', 'ゴブリン', 'ごぶりん', 'goblin', EN],
    ['lw_suraimu', 'スライム', 'すらいむ', 'slime (RPG monster)', EN],
    ['lw_monsutaa', 'モンスター', 'もんすたー', 'monster', EN],
    ['lw_yunikoon', 'ユニコーン', 'ゆにこーん', 'unicorn', EN],
    ['lw_pooshon', 'ポーション', 'ぽーしょん', 'potion', EN],
    ['lw_kuesuto', 'クエスト', 'くえすと', 'quest', EN],
    ['lw_danjon', 'ダンジョン', 'だんじょん', 'dungeon', EN],
    ['lw_girudo', 'ギルド', 'ぎるど', 'guild', EN],
    ['lw_mana', 'マナ', 'まな', 'mana (magic power)', EN],
    ['lw_kurisutaru', 'クリスタル', 'くりすたる', 'crystal', EN],
    ['lw_kaosu', 'カオス', 'かおす', 'chaos', GR],
    ['lw_oora', 'オーラ', 'おーら', 'aura', LA],
    ['lw_manto', 'マント', 'まんと', 'cloak / cape', PT],
    ['lw_doresu', 'ドレス', 'どれす', 'dress', EN, 'c'],
    ['lw_masuku', 'マスク', 'ますく', 'mask', EN, 'c'],
    ['lw_hiiroo', 'ヒーロー', 'ひーろー', 'hero', EN, 'c'],
  ],

  // Left to native vocab (dropped): ゴースト→幽霊, デーモン/デビル→悪魔,
  // ナイトメア→悪夢. Kept genuine katakana-dominant horror/pop-culture terms.
  'horror': [
    ['lw_zonbi', 'ゾンビ', 'ぞんび', 'zombie', EN],
    ['lw_horaa', 'ホラー', 'ほらー', 'horror (genre)', EN],
    ['lw_panikku', 'パニック', 'ぱにっく', 'panic', EN, 'c'],
    ['lw_banpaia', 'バンパイア', 'ばんぱいあ', 'vampire', EN],
    ['lw_suriraa', 'スリラー', 'すりらー', 'thriller', EN],
    ['lw_shokku', 'ショック', 'しょっく', 'shock', EN, 'c'],
    ['lw_torauma', 'トラウマ', 'とらうま', 'trauma (emotional scar)', EN],
    ['lw_naifu', 'ナイフ', 'ないふ', 'knife', EN, 'c'],
    ['lw_miira', 'ミイラ', 'みいら', 'mummy', PT],
    ['lw_guro', 'グロ', 'ぐろ', 'gore / grotesque (slang)', EN],
    ['lw_saiko', 'サイコ', 'さいこ', 'psycho', EN],
    ['lw_karuto', 'カルト', 'かると', 'cult', EN],
    ['lw_sukeruton', 'スケルトン', 'すけるとん', 'skeleton (RPG monster)', EN],
    ['lw_andeddo', 'アンデッド', 'あんでっど', 'undead', EN],
  ],

  // Everyday katakana that's the dominant form (supplements the migrated v_*
  // slice-of-life words). Outer space stays 宇宙 — スペース is the gap/blank sense.
  'slice-of-life': [
    ['lw_supeesu', 'スペース', 'すぺーす', 'space / blank / gap', EN, 'c'],
    // "silver" as a color → native 銀色; but シルバー has a real wasei meaning:
    ['lw_shirubaa', 'シルバー', 'しるばー', 'senior / elderly (wasei)', EN, 'cw', 'シルバーシート = priority seat; シルバー人材 = senior workforce.'],
  ],

  // Native stays native: 犯人・謎・探偵・事件・証拠・暗号. Kept genuine katakana.
  'mystery': [
    ['lw_torikku', 'トリック', 'とりっく', 'trick (of a crime)', EN],
    ['lw_aribai', 'アリバイ', 'ありばい', 'alibi', EN],
    ['lw_misuterii', 'ミステリー', 'みすてりー', 'mystery (genre)', EN],
    ['lw_sasupensu', 'サスペンス', 'さすぺんす', 'suspense', EN],
    ['lw_supai', 'スパイ', 'すぱい', 'spy', EN],
    ['lw_kuraimakkusu', 'クライマックス', 'くらいまっくす', 'climax', EN],
    ['lw_taagetto', 'ターゲット', 'たーげっと', 'target', EN],
    ['lw_suriru', 'スリル', 'すりる', 'thrill', EN],
    ['lw_kamofuraaju', 'カモフラージュ', 'かもふらーじゅ', 'camouflage', FR],
    ['lw_hinto', 'ヒント', 'ひんと', 'hint', EN, 'c'],
    ['lw_pataan', 'パターン', 'ぱたーん', 'pattern', EN, 'c'],
    ['lw_ruuto', 'ルート', 'るーと', 'route', EN, 'c'],
    ['lw_sain', 'サイン', 'さいん', 'sign / signature', EN, 'c'],
    ['lw_maaku', 'マーク', 'まーく', 'mark / to tail (watch)', EN, 'c'],
    ['lw_chekku', 'チェック', 'ちぇっく', 'check / verify', EN, 'c'],
  ],

  // Native stays: 宝・旅・島・罠 (dropped トレジャー→宝, トラップ→罠).
  'adventure': [
    ['lw_mappu', 'マップ', 'まっぷ', 'map (game)', EN],
    ['lw_tento', 'テント', 'てんと', 'tent', EN, 'c'],
    ['lw_booto', 'ボート', 'ぼーと', 'boat (small)', EN, 'c'],
    ['lw_konpasu', 'コンパス', 'こんぱす', 'compass', NL],
    ['lw_roopu', 'ロープ', 'ろーぷ', 'rope', EN],
    ['lw_rantan', 'ランタン', 'らんたん', 'lantern', EN],
    ['lw_kyanpu', 'キャンプ', 'きゃんぷ', 'camp / camping', EN, 'c'],
    ['lw_janguru', 'ジャングル', 'じゃんぐる', 'jungle', EN],
    ['lw_sabaibaru', 'サバイバル', 'さばいばる', 'survival', EN],
    ['lw_aitemu', 'アイテム', 'あいてむ', 'item (game)', EN],
    ['lw_gooru', 'ゴール', 'ごーる', 'goal', EN, 'c'],
    ['lw_sutaato', 'スタート', 'すたーと', 'start', EN, 'c'],
    ['lw_reberu', 'レベル', 'れべる', 'level (game)', EN, 'c'],
    ['lw_bosu', 'ボス', 'ぼす', 'boss (enemy)', EN],
    ['lw_ryukku', 'リュック', 'りゅっく', 'backpack', DE, 'c'],
    ['lw_gaido', 'ガイド', 'がいど', 'guide', EN, 'c'],
    ['lw_pinchi', 'ピンチ', 'ぴんち', 'pinch / tight spot', EN],
    ['lw_chansu', 'チャンス', 'ちゃんす', 'chance', EN, 'c'],
  ],

  // Native stays: 漫才・落語・ボケ・ツッコミ・ネタ・オチ・冗談. テンション /
  // ハイテンション are wasei-eigo (made-in-Japan English).
  'humor': [
    ['lw_gyagu', 'ギャグ', 'ぎゃぐ', 'gag (joke)', EN],
    ['lw_konto', 'コント', 'こんと', 'comedy skit', FR],
    ['lw_jooku', 'ジョーク', 'じょーく', 'joke', EN],
    ['lw_yuumoa', 'ユーモア', 'ゆーもあ', 'humor', EN],
    ['lw_komedi', 'コメディ', 'こめでぃ', 'comedy', EN],
    ['lw_piero', 'ピエロ', 'ぴえろ', 'clown', FR],
    ['lw_nansensu', 'ナンセンス', 'なんせんす', 'nonsense', EN],
    ['lw_parodi', 'パロディ', 'ぱろでぃ', 'parody', EN],
    ['lw_hapuningu', 'ハプニング', 'はぷにんぐ', 'funny mishap / unexpected event', EN],
    ['lw_sapuraizu', 'サプライズ', 'さぷらいず', 'surprise', EN, 'c'],
    ['lw_jesuchaa', 'ジェスチャー', 'じぇすちゃー', 'gesture', EN, 'c'],
    ['lw_tenshon', 'テンション', 'てんしょん', 'mood / energy level (wasei-eigo)', EN, 'c'],
    ['lw_haitenshon', 'ハイテンション', 'はいてんしょん', 'hyper / high-energy (wasei-eigo)', EN],
  ],

  // ONLY historically authentic early loanwords (modern katakana is anachronistic
  // in an Edo/Meiji setting): Portuguese trade era → Dutch rangaku → Bakumatsu/Meiji.
  'period-piece': [
    ['lw_kasutera', 'カステラ', 'かすてら', 'castella (sponge cake)', PT],
    ['lw_tabako', 'タバコ', 'たばこ', 'tobacco', PT, 'c'],
    ['lw_karuta', 'カルタ', 'かるた', 'karuta (playing cards)', PT],
    ['lw_biidoro', 'ビードロ', 'びーどろ', 'vidro — Edo-era blown glass', PT],
    ['lw_ranpu', 'ランプ', 'らんぷ', 'oil lamp', NL],
    ['lw_koppu', 'コップ', 'こっぷ', 'drinking cup / glass', NL, 'c'],
    ['lw_zubon', 'ズボン', 'ずぼん', 'trousers', FR, 'c'],
    ['lw_haikara', 'ハイカラ', 'はいから', 'Westernized / stylish (Meiji)', EN],
    ['lw_mishin', 'ミシン', 'みしん', 'sewing machine', EN, 'c'],
    ['lw_pisutoru', 'ピストル', 'ぴすとる', 'pistol', NL],
    ['lw_orugan', 'オルガン', 'おるがん', 'organ (reed instrument)', PT],
  ],

  // Big group. Native staples (ご飯・味噌・醤油・お茶・寿司…) stay native; these are
  // the genuinely-katakana Western/Chinese foods. (Migrated foods カレー/パン/
  // コーヒー… are re-tagged into 'food' via RETAG, not duplicated here.)
  'food': [
    ['lw_raamen', 'ラーメン', 'らーめん', 'ramen', CN, 'c'],
    ['lw_pasuta', 'パスタ', 'ぱすた', 'pasta', IT, 'c'],
    ['lw_supagetti', 'スパゲッティ', 'すぱげってぃ', 'spaghetti', IT],
    ['lw_suteeki', 'ステーキ', 'すてーき', 'steak', EN, 'c'],
    ['lw_hanbaagaa', 'ハンバーガー', 'はんばーがー', 'hamburger', EN, 'c'],
    ['lw_hanbaagu', 'ハンバーグ', 'はんばーぐ', 'hamburg steak (wasei)', EN],
    ['lw_omuretsu', 'オムレツ', 'おむれつ', 'omelette', FR],
    ['lw_guratan', 'グラタン', 'ぐらたん', 'gratin', FR],
    ['lw_katsu', 'カツ', 'かつ', 'cutlet (short for カツレツ)', EN],
    ['lw_furai', 'フライ', 'ふらい', 'deep-fried food', EN],
    ['lw_tomato', 'トマト', 'とまと', 'tomato', EN, 'c'],
    ['lw_poteto', 'ポテト', 'ぽてと', 'potato (fries/chips)', EN, 'c'],
    ['lw_bataa', 'バター', 'ばたー', 'butter', EN, 'c'],
    ['lw_chiizu', 'チーズ', 'ちーず', 'cheese', EN, 'c'],
    ['lw_miruku', 'ミルク', 'みるく', 'milk (in coffee/tea)', EN, 'c'],
    ['lw_yooguruto', 'ヨーグルト', 'よーぐると', 'yogurt', EN, 'c'],
    ['lw_hamu', 'ハム', 'はむ', 'ham', EN, 'c'],
    ['lw_sooseeji', 'ソーセージ', 'そーせーじ', 'sausage', EN, 'c'],
    ['lw_beekon', 'ベーコン', 'べーこん', 'bacon', EN, 'c'],
    ['lw_kukkii', 'クッキー', 'くっきー', 'cookie', EN, 'c'],
    ['lw_bisuketto', 'ビスケット', 'びすけっと', 'biscuit', EN],
    ['lw_doonatsu', 'ドーナツ', 'どーなつ', 'donut', EN, 'c'],
    ['lw_pankeeki', 'パンケーキ', 'ぱんけーき', 'pancake', EN],
    ['lw_kyandi', 'キャンディ', 'きゃんでぃ', 'candy', EN, 'c'],
    ['lw_zerii', 'ゼリー', 'ぜりー', 'jelly', EN, 'c'],
    ['lw_gamu', 'ガム', 'がむ', 'chewing gum', EN, 'c'],
    ['lw_aisu', 'アイス', 'あいす', 'ice cream (short)', EN, 'c'],
    ['lw_soosu', 'ソース', 'そーす', 'sauce', EN, 'c'],
    ['lw_kechappu', 'ケチャップ', 'けちゃっぷ', 'ketchup', EN, 'c'],
    ['lw_mayoneezu', 'マヨネーズ', 'まよねーず', 'mayonnaise', FR, 'c'],
    ['lw_doresshingu', 'ドレッシング', 'どれっしんぐ', 'salad dressing', EN],
    ['lw_jamu', 'ジャム', 'じゃむ', 'jam', EN, 'c'],
    ['lw_biiru', 'ビール', 'びーる', 'beer', NL, 'c'],
    ['lw_wain', 'ワイン', 'わいん', 'wine', EN, 'c'],
    ['lw_suupu', 'スープ', 'すーぷ', 'soup (Western)', EN, 'c'],
    ['lw_kakuteru', 'カクテル', 'かくてる', 'cocktail', EN],
    ['lw_menyuu', 'メニュー', 'めにゅー', 'menu', FR, 'c'],
    ['lw_reshipi', 'レシピ', 'れしぴ', 'recipe', EN, 'c'],
    ['lw_dezaato', 'デザート', 'でざーと', 'dessert', EN, 'c'],
    ['lw_fooku', 'フォーク', 'ふぉーく', 'fork', EN, 'c'],
    ['lw_supuun', 'スプーン', 'すぷーん', 'spoon', EN, 'c'],
  ],

  // Country names — the katakana IS the everyday form (フランスに行く, not 仏に行く;
  // the kanji 仏・独・米 only appear in formal compounds). Per user: flag = the
  // COUNTRY's own flag, borrowing etymology in the note. アメリカ/イギリス reuse
  // their migrated v_* ids (origin re-pointed to the country). 韓国/中国 stay
  // native kanji (no everyday katakana form).
  'countries': [
    ['v_america', 'アメリカ', 'あめりか', 'America / the United States', 'United States', 'c', "From English 'America'."],
    ['v_igirisu', 'イギリス', 'いぎりす', 'England / the United Kingdom', 'United Kingdom', 'c', "From Portuguese 'Inglez'."],
    ['lw_furansu', 'フランス', 'ふらんす', 'France', 'France', 'c', "From French 'France'."],
    ['lw_doitsu', 'ドイツ', 'どいつ', 'Germany', 'Germany', 'c', "Name borrowed via Dutch 'Duits'."],
    ['lw_oranda', 'オランダ', 'おらんだ', 'Holland / the Netherlands', 'Netherlands', 'c', "From Portuguese 'Olanda'."],
    ['lw_itaria', 'イタリア', 'いたりあ', 'Italy', 'Italy', 'c', "From Italian 'Italia'."],
    ['lw_supein', 'スペイン', 'すぺいん', 'Spain', 'Spain', 'c'],
    ['lw_roshia', 'ロシア', 'ろしあ', 'Russia', 'Russia', 'c'],
    ['lw_kanada', 'カナダ', 'かなだ', 'Canada', 'Canada', 'c'],
    ['lw_burajiru', 'ブラジル', 'ぶらじる', 'Brazil', 'Brazil', 'c', "From Portuguese 'Brasil'."],
    ['lw_oosutoraria', 'オーストラリア', 'おーすとらりあ', 'Australia', 'Australia', 'c'],
    ['lw_indo', 'インド', 'いんど', 'India', 'India', 'c', "From Portuguese 'Indo'."],
    ['lw_mekishiko', 'メキシコ', 'めきしこ', 'Mexico', 'Mexico', 'c'],
    ['lw_ejiputo', 'エジプト', 'えじぷと', 'Egypt', 'Egypt', 'c'],
    ['lw_girisha', 'ギリシャ', 'ぎりしゃ', 'Greece', 'Greece', 'c'],
    ['lw_toruko', 'トルコ', 'とるこ', 'Turkey', 'Turkey', 'c', "From Portuguese 'Turco'."],
    ['lw_suisu', 'スイス', 'すいす', 'Switzerland', 'Switzerland', 'c'],
  ],

  // Travel + foreign currency (円 stays native; ドル/ユーロ/ポンド are katakana).
  // Migrated ホテル/タクシー/バス are re-tagged into Travel via RETAG.
  'travel': [
    ['lw_pasupooto', 'パスポート', 'ぱすぽーと', 'passport', EN, 'c'],
    ['lw_biza', 'ビザ', 'びざ', 'visa', EN],
    ['lw_chiketto', 'チケット', 'ちけっと', 'ticket (event/plane)', EN, 'c'],
    ['lw_suutsukeesu', 'スーツケース', 'すーつけーす', 'suitcase', EN],
    ['lw_furonto', 'フロント', 'ふろんと', 'hotel front desk (wasei)', EN],
    ['lw_chekkuin', 'チェックイン', 'ちぇっくいん', 'check-in', EN],
    ['lw_chekkuauto', 'チェックアウト', 'ちぇっくあうと', 'check-out', EN],
    ['lw_robii', 'ロビー', 'ろびー', 'lobby', EN],
    ['lw_tsuaa', 'ツアー', 'つあー', 'tour', EN, 'c'],
    ['lw_sukejuuru', 'スケジュール', 'すけじゅーる', 'schedule', EN, 'c'],
    ['lw_puran', 'プラン', 'ぷらん', 'plan', EN, 'c'],
    ['lw_furaito', 'フライト', 'ふらいと', 'flight', EN],
    ['lw_geeto', 'ゲート', 'げーと', 'gate (airport)', EN],
    ['lw_taaminaru', 'ターミナル', 'たーみなる', 'terminal', EN],
    ['lw_kauntaa', 'カウンター', 'かうんたー', 'counter (desk)', EN, 'c'],
    ['lw_rizooto', 'リゾート', 'りぞーと', 'resort', EN],
    ['lw_biichi', 'ビーチ', 'びーち', 'beach (resort)', EN, 'c'],
    ['lw_puuru', 'プール', 'ぷーる', 'swimming pool', EN, 'c'],
    ['lw_rentakaa', 'レンタカー', 'れんたかー', 'rental car', EN],
    ['lw_sutanpu', 'スタンプ', 'すたんぷ', 'stamp', EN, 'c'],
    ['lw_doru', 'ドル', 'どる', 'dollar', EN, 'c'],
    ['lw_yuuro', 'ユーロ', 'ゆーろ', 'euro', EN, 'c'],
    ['lw_pondo', 'ポンド', 'ぽんど', 'pound (£ / weight)', EN],
    ['lw_sento', 'セント', 'せんと', 'cent', EN],
    ['lw_reeto', 'レート', 'れーと', 'exchange rate', EN, 'c'],
    ['lw_kaado', 'カード', 'かーど', 'card (credit card)', EN, 'c'],
    ['lw_chippu', 'チップ', 'ちっぷ', 'tip (gratuity)', EN],
  ],

  // Units of measure. The METRIC system is French → メートル/グラム/リットル are 🇫🇷;
  // imperial units (インチ/マイル/フィート) are 🇺🇸. メーター(gauge) is separate (sci-fi).
  'measurement': [
    ['lw_kiro', 'キロ', 'きろ', 'kilo (kg / km)', FR, 'c'],
    ['lw_meetoru', 'メートル', 'めーとる', 'meter (length)', FR, 'c'],
    ['lw_senchi', 'センチ', 'せんち', 'centimeter', FR, 'c'],
    ['lw_miri', 'ミリ', 'みり', 'millimeter', FR, 'c'],
    ['lw_guramu', 'グラム', 'ぐらむ', 'gram', FR, 'c'],
    ['lw_kiroguramu', 'キログラム', 'きろぐらむ', 'kilogram', FR],
    ['lw_rittoru', 'リットル', 'りっとる', 'liter', FR, 'c'],
    ['lw_karorii', 'カロリー', 'かろりー', 'calorie', FR, 'c'],
    ['lw_paasento', 'パーセント', 'ぱーせんと', 'percent', EN, 'c'],
    ['lw_saizu', 'サイズ', 'さいず', 'size', EN, 'c'],
    ['lw_ton', 'トン', 'とん', 'ton', EN],
    ['lw_inchi', 'インチ', 'いんち', 'inch', EN],
    ['lw_fiito', 'フィート', 'ふぃーと', 'feet', EN],
    ['lw_mairu', 'マイル', 'まいる', 'mile', EN],
  ],

  // Tier-1: the most everyday-essential domain. Tech vocab is overwhelmingly
  // katakana in Japanese (native equivalents are archaic). コンセント = wasei.
  'technology': [
    ['lw_apuri', 'アプリ', 'あぷり', 'app', EN, 'c'],
    ['lw_netto', 'ネット', 'ねっと', 'the net / internet', EN, 'c'],
    ['lw_intaanetto', 'インターネット', 'いんたーねっと', 'internet', EN],
    ['lw_saito', 'サイト', 'さいと', 'website', EN, 'c'],
    ['lw_webu', 'ウェブ', 'うぇぶ', 'web', EN],
    ['lw_burogu', 'ブログ', 'ぶろぐ', 'blog', EN, 'c'],
    ['lw_messeeji', 'メッセージ', 'めっせーじ', 'message', EN, 'c'],
    ['lw_chatto', 'チャット', 'ちゃっと', 'chat', EN, 'c'],
    ['lw_onrain', 'オンライン', 'おんらいん', 'online', EN, 'c'],
    ['lw_ofurain', 'オフライン', 'おふらいん', 'offline', EN],
    ['lw_daunroodo', 'ダウンロード', 'だうんろーど', 'download', EN, 'c'],
    ['lw_appuroodo', 'アップロード', 'あっぷろーど', 'upload', EN],
    ['lw_appudeeto', 'アップデート', 'あっぷでーと', 'update', EN, 'c'],
    ['lw_insutooru', 'インストール', 'いんすとーる', 'install', EN],
    ['lw_roguin', 'ログイン', 'ろぐいん', 'login', EN, 'c'],
    ['lw_roguauto', 'ログアウト', 'ろぐあうと', 'logout', EN],
    ['lw_pasuwaado', 'パスワード', 'ぱすわーど', 'password', EN, 'c'],
    ['lw_akaunto', 'アカウント', 'あかうんと', 'account', EN, 'c'],
    ['lw_yuuzaa', 'ユーザー', 'ゆーざー', 'user', EN, 'c'],
    ['lw_fairu', 'ファイル', 'ふぁいる', 'file', EN, 'c'],
    ['lw_foruda', 'フォルダ', 'ふぉるだ', 'folder', EN],
    ['lw_sofuto', 'ソフト', 'そふと', 'software (clipping)', EN, 'c'],
    ['lw_haado', 'ハード', 'はーど', 'hardware (clipping)', EN],
    ['lw_kurikku', 'クリック', 'くりっく', 'click', EN, 'c'],
    ['lw_tappu', 'タップ', 'たっぷ', 'tap', EN, 'c'],
    ['lw_sukurooru', 'スクロール', 'すくろーる', 'scroll', EN],
    ['lw_kopii', 'コピー', 'こぴー', 'copy', EN, 'c'],
    ['lw_rinku', 'リンク', 'りんく', 'link', EN, 'c'],
    ['lw_aikon', 'アイコン', 'あいこん', 'icon', EN, 'c'],
    ['lw_bagu', 'バグ', 'ばぐ', 'bug (software)', EN],
    ['lw_mobairu', 'モバイル', 'もばいる', 'mobile', EN],
    ['lw_konsento', 'コンセント', 'こんせんと', 'electrical outlet (wasei)', EN, 'cw'],
  ],

  // Sports are imports → katakana dominant. Native stays: 野球(baseball!), 相撲,
  // 柔道・剣道・空手・水泳. Etymology gems: スキー🇳🇴, マラソン🇬🇷, ヨガ🕉, ラグビー🇬🇧.
  'sports': [
    ['lw_supootsu', 'スポーツ', 'すぽーつ', 'sport(s)', EN, 'c'],
    ['lw_sakkaa', 'サッカー', 'さっかー', 'soccer', EN, 'c'],
    ['lw_tenisu', 'テニス', 'てにす', 'tennis', EN, 'c'],
    ['lw_gorufu', 'ゴルフ', 'ごるふ', 'golf', EN, 'c'],
    ['lw_basuke', 'バスケ', 'ばすけ', 'basketball (clipping)', EN, 'c'],
    ['lw_bareebooru', 'バレーボール', 'ばれーぼーる', 'volleyball', EN],
    ['lw_sukii', 'スキー', 'すきー', 'skiing', NO],
    ['lw_sukeeto', 'スケート', 'すけーと', 'skating', EN],
    ['lw_marason', 'マラソン', 'まらそん', 'marathon', GR],
    ['lw_jogingu', 'ジョギング', 'じょぎんぐ', 'jogging', EN, 'c'],
    ['lw_ranningu', 'ランニング', 'らんにんぐ', 'running', EN, 'c'],
    ['lw_toreeningu', 'トレーニング', 'とれーにんぐ', 'training', EN, 'c'],
    ['lw_chiimu', 'チーム', 'ちーむ', 'team', EN, 'c'],
    ['lw_koochi', 'コーチ', 'こーち', 'coach', EN, 'c'],
    ['lw_booru', 'ボール', 'ぼーる', 'ball', EN, 'c'],
    ['lw_raketto', 'ラケット', 'らけっと', 'racket', EN],
    ['lw_sukoa', 'スコア', 'すこあ', 'score', EN],
    ['lw_ruuru', 'ルール', 'るーる', 'rule', EN, 'c'],
    ['lw_shuuto', 'シュート', 'しゅーと', 'shoot / shot', EN],
    ['lw_pasu', 'パス', 'ぱす', 'pass', EN, 'c'],
    ['lw_jimu', 'ジム', 'じむ', 'gym', EN, 'c'],
    ['lw_yoga', 'ヨガ', 'よが', 'yoga', SA],
    ['lw_bokushingu', 'ボクシング', 'ぼくしんぐ', 'boxing', EN],
    ['lw_medaru', 'メダル', 'めだる', 'medal', EN, 'c'],
    ['lw_orinpikku', 'オリンピック', 'おりんぴっく', 'the Olympics', GR],
    ['lw_ragubii', 'ラグビー', 'らぐびー', 'rugby', BR],
    ['lw_badominton', 'バドミントン', 'ばどみんとん', 'badminton', BR],
    ['lw_saafin', 'サーフィン', 'さーふぃん', 'surfing', EN],
    ['lw_sutajiamu', 'スタジアム', 'すたじあむ', 'stadium', LA],
  ],

  // Western instruments + genres are katakana; native 歌・音楽・三味線・琴・太鼓 stay.
  // Gems: ピアノ🇮🇹, ギター🇪🇸, リズム/ハーモニー🇬🇷. カラオケ = wasei, exported worldwide.
  'music': [
    ['lw_piano', 'ピアノ', 'ぴあの', 'piano', IT, 'c'],
    ['lw_gitaa', 'ギター', 'ぎたー', 'guitar', ES, 'c'],
    ['lw_baiorin', 'バイオリン', 'ばいおりん', 'violin', IT],
    ['lw_doramu', 'ドラム', 'どらむ', 'drums', EN, 'c'],
    ['lw_toranpetto', 'トランペット', 'とらんぺっと', 'trumpet', EN],
    ['lw_furuuto', 'フルート', 'ふるーと', 'flute', EN],
    ['lw_sakkusu', 'サックス', 'さっくす', 'saxophone (clipping)', EN],
    ['lw_haamonika', 'ハーモニカ', 'はーもにか', 'harmonica', EN],
    ['lw_kiiboodo', 'キーボード', 'きーぼーど', 'keyboard', EN],
    ['lw_beesu', 'ベース', 'べーす', 'bass (guitar)', EN],
    ['lw_maiku', 'マイク', 'まいく', 'microphone (clipping)', EN, 'c'],
    ['lw_supiikaa', 'スピーカー', 'すぴーかー', 'speaker', EN, 'c'],
    ['lw_heddohon', 'ヘッドホン', 'へっどほん', 'headphones', EN, 'c'],
    ['lw_jazu', 'ジャズ', 'じゃず', 'jazz', EN],
    ['lw_rokku', 'ロック', 'ろっく', 'rock (music)', EN, 'c'],
    ['lw_kurashikku', 'クラシック', 'くらしっく', 'classical music', EN, 'c'],
    ['lw_poppusu', 'ポップス', 'ぽっぷす', 'pop music', EN],
    ['lw_hippuhoppu', 'ヒップホップ', 'ひっぷほっぷ', 'hip-hop', EN],
    ['lw_bando', 'バンド', 'ばんど', 'band', EN, 'c'],
    ['lw_merodi', 'メロディ', 'めろでぃ', 'melody', EN],
    ['lw_rizumu', 'リズム', 'りずむ', 'rhythm', GR],
    ['lw_haamonii', 'ハーモニー', 'はーもにー', 'harmony', GR],
    ['lw_raibu', 'ライブ', 'らいぶ', 'live show (wasei)', EN, 'cw'],
    ['lw_bookaru', 'ボーカル', 'ぼーかる', 'vocals', EN],
    ['lw_karaoke', 'カラオケ', 'からおけ', 'karaoke', EN, 'cw', '空(kara, empty) + オケ(orchestra). Coined in Japan; now a global word.'],
    ['lw_arubamu', 'アルバム', 'あるばむ', 'album', EN, 'c'],
    ['lw_rekoodo', 'レコード', 'れこーど', 'record', EN],
  ],

  // Workplace. Native stays: 会社・仕事・社長・上司. Wasei gems: サラリーマン,
  // フリーター(free+Arbeiter). ノルマ is a Soviet-era loan from Russian.
  'business': [
    ['lw_bijinesu', 'ビジネス', 'びじねす', 'business', EN, 'c'],
    ['lw_miitingu', 'ミーティング', 'みーてぃんぐ', 'meeting', EN, 'c'],
    ['lw_purezen', 'プレゼン', 'ぷれぜん', 'presentation (clipping)', EN, 'c'],
    ['lw_purojekuto', 'プロジェクト', 'ぷろじぇくと', 'project', EN, 'c'],
    ['lw_kuraianto', 'クライアント', 'くらいあんと', 'client', EN],
    ['lw_apo', 'アポ', 'あぽ', 'appointment (clipping)', EN],
    ['lw_repooto', 'レポート', 'れぽーと', 'report', EN, 'c'],
    ['lw_manyuaru', 'マニュアル', 'まにゅある', 'manual', EN, 'c'],
    ['lw_riidaa', 'リーダー', 'りーだー', 'leader', EN, 'c'],
    ['lw_menbaa', 'メンバー', 'めんばー', 'member', EN, 'c'],
    ['lw_sutaffu', 'スタッフ', 'すたっふ', 'staff', EN, 'c'],
    ['lw_maneejaa', 'マネージャー', 'まねーじゃー', 'manager', EN, 'c'],
    ['lw_ofisu', 'オフィス', 'おふぃす', 'office', EN, 'c'],
    ['lw_desuku', 'デスク', 'ですく', 'desk', EN],
    ['lw_aidea', 'アイデア', 'あいであ', 'idea', EN, 'c'],
    ['lw_kosuto', 'コスト', 'こすと', 'cost', EN],
    ['lw_biru', 'ビル', 'びる', 'office building (clipping)', EN, 'c'],
    ['lw_sarariiman', 'サラリーマン', 'さらりーまん', 'salaried office worker (wasei)', EN, 'cw'],
    ['lw_paato', 'パート', 'ぱーと', 'part-time work', EN, 'c'],
    ['lw_furiitaa', 'フリーター', 'ふりーたー', 'freeter — casual worker (wasei)', EN, 'cw', "free (EN) + Arbeiter (DE) — coined in Japan."],
    ['lw_noruma', 'ノルマ', 'のるま', 'quota', RU],
    ['lw_kyaria', 'キャリア', 'きゃりあ', 'career', EN, 'c'],
    ['lw_sukiru', 'スキル', 'すきる', 'skill', EN, 'c'],
    ['lw_karendaa', 'カレンダー', 'かれんだー', 'calendar', EN, 'c'],
    ['lw_suutsu', 'スーツ', 'すーつ', 'business suit', EN, 'c'],
  ],

  // Native stays: 体・健康・病気・薬・病院・医者. MEDICINE is German (Meiji medicine
  // came from Germany): アレルギー・ワクチン・カルテ・ガーゼ・ギプス 🇩🇪. Beauty leans French.
  'health': [
    ['lw_sutoresu', 'ストレス', 'すとれす', 'stress', EN, 'c'],
    ['lw_daietto', 'ダイエット', 'だいえっと', 'dieting / losing weight (meaning-shift)', EN, 'cw'],
    ['lw_bitamin', 'ビタミン', 'びたみん', 'vitamin', DE],
    ['lw_sutorecchi', 'ストレッチ', 'すとれっち', 'stretching', EN],
    ['lw_rirakkusu', 'リラックス', 'りらっくす', 'relax', EN, 'c'],
    ['lw_herushii', 'ヘルシー', 'へるしー', 'healthy', EN, 'c'],
    ['lw_surimu', 'スリム', 'すりむ', 'slim', EN],
    ['lw_sapuri', 'サプリ', 'さぷり', 'supplement (clipping)', EN, 'c'],
    ['lw_arerugii', 'アレルギー', 'あれるぎー', 'allergy', DE],
    ['lw_wakuchin', 'ワクチン', 'わくちん', 'vaccine', DE],
    ['lw_gaaze', 'ガーゼ', 'がーぜ', 'gauze', DE],
    ['lw_karute', 'カルテ', 'かるて', 'medical chart / records', DE],
    ['lw_gipusu', 'ギプス', 'ぎぷす', 'plaster cast', DE],
    ['lw_massaaji', 'マッサージ', 'まっさーじ', 'massage', FR, 'c'],
    ['lw_shanpuu', 'シャンプー', 'しゃんぷー', 'shampoo', EN, 'c'],
    ['lw_rinsu', 'リンス', 'りんす', 'hair conditioner (meaning-shift)', EN, 'w'],
    ['lw_kuriimu', 'クリーム', 'くりーむ', 'cream', EN, 'c'],
    ['lw_rooshon', 'ローション', 'ろーしょん', 'lotion', EN],
    ['lw_masukara', 'マスカラ', 'ますから', 'mascara', IT],
    ['lw_meiku', 'メイク', 'めいく', 'makeup (clipping)', EN, 'c'],
    ['lw_kosume', 'コスメ', 'こすめ', 'cosmetics (clipping)', EN, 'c'],
    ['lw_neiru', 'ネイル', 'ねいる', 'nails / manicure', EN],
    ['lw_esute', 'エステ', 'えすて', 'beauty salon / spa (clipping)', FR],
    ['lw_manikyua', 'マニキュア', 'まにきゅあ', 'nail polish', FR],
    ['lw_jeru', 'ジェル', 'じぇる', 'gel', EN],
  ],

  // Native stays: 科学・実験・研究・原子. The most origin-DIVERSE batch — German
  // テーマ/ホルモン, Greek プラズマ/イオン, Latin レンズ, Arabic アルコール, Dutch メス.
  'science': [
    ['lw_arukooru', 'アルコール', 'あるこーる', 'alcohol', AR, '', 'Via Dutch; ultimately Arabic al-kuḥl.'],
    ['lw_renzu', 'レンズ', 'れんず', 'lens', LA],
    ['lw_gurafu', 'グラフ', 'ぐらふ', 'graph', EN],
    ['lw_teema', 'テーマ', 'てーま', 'theme / topic', DE],
    ['lw_purasu', 'プラス', 'ぷらす', 'plus', EN, 'c'],
    ['lw_mainasu', 'マイナス', 'まいなす', 'minus', EN, 'c'],
    ['lw_purazuma', 'プラズマ', 'ぷらずま', 'plasma', GR],
    ['lw_ion', 'イオン', 'いおん', 'ion', GR],
    ['lw_bakuteria', 'バクテリア', 'ばくてりあ', 'bacteria', LA],
    ['lw_horumon', 'ホルモン', 'ほるもん', 'hormone', DE],
    ['lw_maguma', 'マグマ', 'まぐま', 'magma', LA],
    ['lw_pawaa', 'パワー', 'ぱわー', 'power', EN, 'c'],
    ['lw_supiido', 'スピード', 'すぴーど', 'speed', EN, 'c'],
    ['lw_baransu', 'バランス', 'ばらんす', 'balance', EN, 'c'],
    ['lw_sanpuru', 'サンプル', 'さんぷる', 'sample', EN, 'c'],
    ['lw_furasuko', 'フラスコ', 'ふらすこ', 'lab flask', PT],
    ['lw_biikaa', 'ビーカー', 'びーかー', 'beaker', EN],
    ['lw_pinsetto', 'ピンセット', 'ぴんせっと', 'tweezers', FR],
    ['lw_mesu', 'メス', 'めす', 'scalpel', NL],
    ['lw_antena', 'アンテナ', 'あんてな', 'antenna', LA, 'c'],
    ['lw_mootaa', 'モーター', 'もーたー', 'motor', EN, 'c'],
  ],

  // Western kitchen tools/methods (native stays: 鍋・まな板・箸・包丁). Method words
  // also tag Food (see RETAG). ミキサー = blender (meaning-shift wasei).
  'cooking': [
    ['lw_oobun', 'オーブン', 'おーぶん', 'oven', EN, 'c'],
    ['lw_renji', 'レンジ', 'れんじ', 'microwave (clipping of 電子レンジ)', EN, 'c'],
    ['lw_furaipan', 'フライパン', 'ふらいぱん', 'frying pan', EN, 'c'],
    ['lw_toosutaa', 'トースター', 'とーすたー', 'toaster', EN, 'c'],
    ['lw_mikisaa', 'ミキサー', 'みきさー', 'blender (meaning-shift)', EN, 'cw'],
    ['lw_bouru', 'ボウル', 'ぼうる', 'mixing bowl', EN],
    ['lw_guriru', 'グリル', 'ぐりる', 'grill', EN],
    ['lw_ketoru', 'ケトル', 'けとる', 'kettle', EN],
    ['lw_potto', 'ポット', 'ぽっと', 'pot / kettle / thermos flask', EN, 'c'],
    ['lw_taimaa', 'タイマー', 'たいまー', 'timer', EN, 'c'],
    ['lw_rappu', 'ラップ', 'らっぷ', 'plastic wrap', EN, 'c'],
    ['lw_hoiru', 'ホイル', 'ほいる', 'foil', EN],
    ['lw_piiraa', 'ピーラー', 'ぴーらー', 'peeler', EN],
    ['lw_tongu', 'トング', 'とんぐ', 'tongs', EN],
    ['lw_epuron', 'エプロン', 'えぷろん', 'apron', EN, 'c'],
    ['lw_oodaa', 'オーダー', 'おーだー', 'order (in a restaurant)', EN, 'c'],
    ['lw_boiru', 'ボイル', 'ぼいる', 'to boil', EN],
    ['lw_katto', 'カット', 'かっと', 'to cut', EN, 'c'],
    ['lw_mikkusu', 'ミックス', 'みっくす', 'to mix', EN, 'c'],
    ['lw_toppingu', 'トッピング', 'とっぴんぐ', 'topping', EN, 'c'],
    ['lw_rea', 'レア', 'れあ', 'rare (steak doneness)', EN],
  ],

  // TV/showbiz. Native stays: 番組・映画・俳優・歌手. Wasei gems: タレント(=TV
  // personality), アイドル(=manufactured pop star), リモコン. アニメ is exported.
  'entertainment': [
    ['lw_dorama', 'ドラマ', 'どらま', 'TV drama', EN, 'c'],
    ['lw_anime', 'アニメ', 'あにめ', 'anime', EN, 'c', "Clipping of 'animation' — now a global word for Japanese animation."],
    ['lw_baraeti', 'バラエティ', 'ばらえてぃ', 'variety show', EN, 'c'],
    ['lw_kuizu', 'クイズ', 'くいず', 'quiz (show)', EN, 'c'],
    ['lw_aidoru', 'アイドル', 'あいどる', 'pop idol (meaning-shift)', EN, 'cw'],
    ['lw_tarento', 'タレント', 'たれんと', 'TV personality (wasei)', EN, 'cw'],
    ['lw_sutaa', 'スター', 'すたー', 'star (celebrity)', EN, 'c'],
    ['lw_fan', 'ファン', 'ふぁん', 'fan', EN, 'c'],
    ['lw_suteeji', 'ステージ', 'すてーじ', 'stage', EN, 'c'],
    ['lw_shoo', 'ショー', 'しょー', 'show', EN, 'c'],
    ['lw_channeru', 'チャンネル', 'ちゃんねる', 'TV channel', EN, 'c'],
    ['lw_nyuusu', 'ニュース', 'にゅーす', 'news', EN, 'c'],
    ['lw_myuujikaru', 'ミュージカル', 'みゅーじかる', 'musical', EN],
    ['lw_rimokon', 'リモコン', 'りもこん', 'remote control (clipping, wasei)', EN, 'cw'],
    ['lw_bideo', 'ビデオ', 'びでお', 'video', EN, 'c'],
    ['lw_shiin', 'シーン', 'しーん', 'scene', EN],
    ['lw_sutoorii', 'ストーリー', 'すとーりー', 'story', EN, 'c'],
    ['lw_kyara', 'キャラ', 'きゃら', 'character (clipping)', EN, 'c'],
    ['lw_kyarakutaa', 'キャラクター', 'きゃらくたー', 'character', EN, 'c'],
    ['lw_shiriizu', 'シリーズ', 'しりーず', 'series', EN, 'c'],
    ['lw_episoodo', 'エピソード', 'えぴそーど', 'episode', EN],
    ['lw_akushon', 'アクション', 'あくしょん', 'action (genre)', EN, 'c'],
    ['lw_fantajii', 'ファンタジー', 'ふぁんたじー', 'fantasy (genre)', EN],
  ],

  // Wholesome only. Native stays: 愛・恋・結婚・恋人. Wasei: スキンシップ
  // (= non-romantic physical closeness — a hug, holding hands).
  'romance': [
    ['lw_deeto', 'デート', 'でーと', 'date (romantic outing)', EN, 'c'],
    ['lw_kappuru', 'カップル', 'かっぷる', 'couple', EN, 'c'],
    ['lw_puropoozu', 'プロポーズ', 'ぷろぽーず', 'marriage proposal', EN, 'c'],
    ['lw_romanchikku', 'ロマンチック', 'ろまんちっく', 'romantic', EN, 'c'],
    ['lw_haato', 'ハート', 'はーと', 'heart', EN, 'c'],
    ['lw_kisu', 'キス', 'きす', 'kiss', EN, 'c'],
    ['lw_rabureta', 'ラブレター', 'らぶれたー', 'love letter', EN],
    ['lw_romansu', 'ロマンス', 'ろまんす', 'romance', EN],
    ['lw_hagu', 'ハグ', 'はぐ', 'hug', EN, 'c'],
    ['lw_paatonaa', 'パートナー', 'ぱーとなー', 'partner', EN, 'c'],
    ['lw_ringu', 'リング', 'りんぐ', 'ring (boxing / pair-ring / circle)', EN],
    ['lw_wedingu', 'ウェディング', 'うぇでぃんぐ', 'wedding', EN],
    ['lw_hanemuun', 'ハネムーン', 'はねむーん', 'honeymoon', EN],
    ['lw_barentain', 'バレンタイン', 'ばれんたいん', "Valentine's Day", EN, 'c'],
    ['lw_sukinshippu', 'スキンシップ', 'すきんしっぷ', 'physical closeness / affection (wasei)', EN, 'cw'],
    ['lw_taipu', 'タイプ', 'たいぷ', "(one's) type", EN, 'c'],
    ['lw_muudo', 'ムード', 'むーど', 'mood / atmosphere', EN, 'c'],
  ],

  // Western dress is katakana; native 服・着物・帽子・靴 stay. Wasei: ワンピース
  // (=a dress), ピアス (=pierced earrings). コート/ネクタイ also tag period-piece (Meiji).
  'fashion': [
    ['lw_fasshon', 'ファッション', 'ふぁっしょん', 'fashion', EN, 'c'],
    ['lw_sutairu', 'スタイル', 'すたいる', 'style / figure', EN, 'c'],
    ['lw_burando', 'ブランド', 'ぶらんど', 'brand', EN, 'c'],
    ['lw_moderu', 'モデル', 'もでる', 'model', EN, 'c'],
    ['lw_sukaato', 'スカート', 'すかーと', 'skirt', EN, 'c'],
    ['lw_seetaa', 'セーター', 'せーたー', 'sweater', EN, 'c'],
    ['lw_kooto', 'コート', 'こーと', 'coat', EN, 'c'],
    ['lw_jaketto', 'ジャケット', 'じゃけっと', 'jacket', EN, 'c'],
    ['lw_jiinzu', 'ジーンズ', 'じーんず', 'jeans', EN, 'c'],
    ['lw_nekutai', 'ネクタイ', 'ねくたい', 'necktie', EN, 'c'],
    ['lw_buutsu', 'ブーツ', 'ぶーつ', 'boots', EN, 'c'],
    ['lw_sandaru', 'サンダル', 'さんだる', 'sandals', EN, 'c'],
    ['lw_suniikaa', 'スニーカー', 'すにーかー', 'sneakers', EN, 'c'],
    ['lw_beruto', 'ベルト', 'べると', 'belt', EN, 'c'],
    ['lw_poketto', 'ポケット', 'ぽけっと', 'pocket', EN, 'c'],
    ['lw_mafuraa', 'マフラー', 'まふらー', 'winter scarf', EN, 'c'],
    ['lw_hankachi', 'ハンカチ', 'はんかち', 'handkerchief (clipping)', EN, 'c'],
    ['lw_wanpiisu', 'ワンピース', 'わんぴーす', 'dress (one-piece, wasei)', EN, 'cw'],
    ['lw_akusesarii', 'アクセサリー', 'あくせさりー', 'accessory', EN, 'c'],
    ['lw_nekkuresu', 'ネックレス', 'ねっくれす', 'necklace', EN],
    ['lw_iyaringu', 'イヤリング', 'いやりんぐ', 'earrings (clip-on)', EN],
    ['lw_piasu', 'ピアス', 'ぴあす', 'pierced earrings (wasei)', EN, 'cw'],
    ['lw_ribon', 'リボン', 'りぼん', 'ribbon', EN, 'c'],
    ['lw_pantsu', 'パンツ', 'ぱんつ', 'pants / underwear', EN, 'c'],
  ],

  // Native stays: 気持ち・性格・感情. The WASEI GOLDMINE — many meanings shifted in
  // Japan (スマート=slim not clever; ナイーブ=sensitive; ドライ=unsentimental).
  'emotions': [
    ['lw_puresshaa', 'プレッシャー', 'ぷれっしゃー', 'pressure', EN, 'c'],
    ['lw_pojitibu', 'ポジティブ', 'ぽじてぃぶ', 'positive', EN, 'c'],
    ['lw_negatibu', 'ネガティブ', 'ねがてぃぶ', 'negative', EN, 'c'],
    ['lw_maipeesu', 'マイペース', 'まいぺーす', "at one's own pace (wasei)", EN, 'cw'],
    ['lw_kuuru', 'クール', 'くーる', 'cool / composed', EN, 'c'],
    ['lw_dorai', 'ドライ', 'どらい', 'unsentimental (personality, wasei)', EN, 'cw'],
    ['lw_naiibu', 'ナイーブ', 'ないーぶ', 'sensitive / delicate (meaning-shift)', EN, 'w'],
    ['lw_derikeeto', 'デリケート', 'でりけーと', 'delicate / sensitive', EN, 'c'],
    ['lw_shai', 'シャイ', 'しゃい', 'shy', EN, 'c'],
    ['lw_happii', 'ハッピー', 'はっぴー', 'happy', EN, 'c'],
    ['lw_rakkii', 'ラッキー', 'らっきー', 'lucky', EN, 'c'],
    ['lw_puraido', 'プライド', 'ぷらいど', 'pride', EN, 'c'],
    ['lw_sutoreeto', 'ストレート', 'すとれーと', 'straightforward', EN],
    ['lw_oopun', 'オープン', 'おーぷん', 'open (personality)', EN, 'c'],
    ['lw_akutibu', 'アクティブ', 'あくてぃぶ', 'active / outgoing', EN, 'c'],
    ['lw_buruu', 'ブルー', 'ぶるー', 'feeling down / the blues (wasei)', EN, 'cw'],
    ['lw_sumaato', 'スマート', 'すまーと', 'slim / stylish (NOT clever — wasei)', EN, 'cw'],
    ['lw_yuniiku', 'ユニーク', 'ゆにーく', 'unique / quirky', EN, 'c'],
    ['lw_naabasu', 'ナーバス', 'なーばす', 'nervous', EN],
    ['lw_mochibeeshon', 'モチベーション', 'もちべーしょん', 'motivation', EN, 'c'],
    ['lw_imeeji', 'イメージ', 'いめーじ', 'image / impression', EN, 'c'],
    ['lw_sensu', 'センス', 'せんす', '(good) taste / sense', EN, 'c'],
    ['lw_riaru', 'リアル', 'りある', 'real', EN, 'c'],
  ],

  // Foreign drinks are katakana (お茶・水・酒 stay native). Spirits + coffee culture
  // are an origin showcase: ウォッカ🇷🇺, ジン/ブランデー🇳🇱, espresso family🇮🇹.
  'drinks': [
    ['lw_uisukii', 'ウイスキー', 'ういすきー', 'whiskey', EN],
    ['lw_wokka', 'ウォッカ', 'うぉっか', 'vodka', RU],
    ['lw_jin', 'ジン', 'じん', 'gin', NL],
    ['lw_ramu', 'ラム', 'らむ', 'rum', EN],
    ['lw_tekiira', 'テキーラ', 'てきーら', 'tequila', ES],
    ['lw_burandee', 'ブランデー', 'ぶらんでー', 'brandy', NL],
    ['lw_shanpan', 'シャンパン', 'しゃんぱん', 'champagne', FR],
    ['lw_rikyuuru', 'リキュール', 'りきゅーる', 'liqueur', FR],
    ['lw_haibooru', 'ハイボール', 'はいぼーる', 'highball', EN, 'c'],
    ['lw_sawaa', 'サワー', 'さわー', 'sour (mixed drink)', EN],
    ['lw_koora', 'コーラ', 'こーら', 'cola', EN, 'c'],
    ['lw_sooda', 'ソーダ', 'そーだ', 'soda / carbonated water', EN, 'c'],
    ['lw_saidaa', 'サイダー', 'さいだー', 'clear lemon-lime soda (meaning-shift)', EN, 'cw'],
    ['lw_kokoa', 'ココア', 'ここあ', 'cocoa / hot chocolate', EN, 'c'],
    ['lw_kafeore', 'カフェオレ', 'かふぇおれ', 'café au lait', FR],
    ['lw_kapuchiino', 'カプチーノ', 'かぷちーの', 'cappuccino', IT],
    ['lw_esupuresso', 'エスプレッソ', 'えすぷれっそ', 'espresso', IT],
    ['lw_rate', 'ラテ', 'らて', 'latte', IT],
    ['lw_sumuujii', 'スムージー', 'すむーじー', 'smoothie', EN],
    ['lw_sheiku', 'シェイク', 'しぇいく', 'milkshake', EN],
    ['lw_dorinku', 'ドリンク', 'どりんく', 'drink / beverage', EN, 'c'],
  ],

  // World mythology (JP 神・鬼・龍・天狗 stay native). Western myth vocab is Greek-rich
  // — a fun pattern. Heavily referenced in games/anime.
  'mythology': [
    ['lw_zeusu', 'ゼウス', 'ぜうす', 'Zeus', GR],
    ['lw_poseidon', 'ポセイドン', 'ぽせいどん', 'Poseidon', GR],
    ['lw_aporo', 'アポロ', 'あぽろ', 'Apollo', GR],
    ['lw_atena', 'アテナ', 'あてな', 'Athena', GR],
    ['lw_herakuresu', 'ヘラクレス', 'へらくれす', 'Heracles / Hercules', GR],
    ['lw_pegasasu', 'ペガサス', 'ぺがさす', 'Pegasus', GR],
    ['lw_taitan', 'タイタン', 'たいたん', 'Titan', GR],
    ['lw_myuuzu', 'ミューズ', 'みゅーず', 'Muse', GR],
    ['lw_meduusa', 'メドゥーサ', 'めどぅーさ', 'Medusa', GR],
    ['lw_sufinkusu', 'スフィンクス', 'すふぃんくす', 'Sphinx', GR],
    ['lw_fenikkusu', 'フェニックス', 'ふぇにっくす', 'phoenix', GR],
    ['lw_yuutopia', 'ユートピア', 'ゆーとぴあ', 'utopia', GR],
    ['lw_piramiddo', 'ピラミッド', 'ぴらみっど', 'pyramid', GR],
    ['lw_oodin', 'オーディン', 'おーでぃん', 'Odin (Norse)', NO],
    ['lw_tooru', 'トール', 'とーる', 'Thor (Norse)', NO],
  ],

  // Foreign animals are katakana; native 犬・猫・鳥・魚・象・虎 stay native.
  'animals': [
    ['lw_raion', 'ライオン', 'らいおん', 'lion', EN, 'c'],
    ['lw_panda', 'パンダ', 'ぱんだ', 'panda', EN, 'c'],
    ['lw_koara', 'コアラ', 'こあら', 'koala', EN],
    ['lw_kangaruu', 'カンガルー', 'かんがるー', 'kangaroo', EN],
    ['lw_gorira', 'ゴリラ', 'ごりら', 'gorilla', EN],
    ['lw_chinpanjii', 'チンパンジー', 'ちんぱんじー', 'chimpanzee', EN],
    ['lw_pengin', 'ペンギン', 'ぺんぎん', 'penguin', EN, 'c'],
    ['lw_hamusutaa', 'ハムスター', 'はむすたー', 'hamster', EN, 'c'],
    ['lw_chiitaa', 'チーター', 'ちーたー', 'cheetah', EN],
    ['lw_jagaa', 'ジャガー', 'じゃがー', 'jaguar', EN],
    ['lw_kamereon', 'カメレオン', 'かめれおん', 'chameleon', EN],
    ['lw_iguana', 'イグアナ', 'いぐあな', 'iguana', ES],
    ['lw_perikan', 'ペリカン', 'ぺりかん', 'pelican', EN],
    ['lw_furamingo', 'フラミンゴ', 'ふらみんご', 'flamingo', PT],
    ['lw_petto', 'ペット', 'ぺっと', 'pet', EN, 'c'],
    ['lw_haabu', 'ハーブ', 'はーぶ', 'herb(s)', EN, 'c'],
  ],

  // Daily home life. Wasei gems: マンション(=apartment bldg), ストーブ(=heater),
  // エアコン, リビング. Native stays: 家・部屋・台所(though キッチン is common too).
  'household': [
    ['lw_manshon', 'マンション', 'まんしょん', 'apartment building / condo (wasei)', EN, 'cw'],
    ['lw_apaato', 'アパート', 'あぱーと', 'apartment (clipping)', EN, 'c'],
    ['lw_eakon', 'エアコン', 'えあこん', 'air conditioner (clipping, wasei)', EN, 'cw'],
    ['lw_sutoobu', 'ストーブ', 'すとーぶ', 'heater (meaning-shift)', EN, 'cw'],
    ['lw_sofa', 'ソファ', 'そふぁ', 'sofa', EN, 'c'],
    ['lw_kaaten', 'カーテン', 'かーてん', 'curtain', EN, 'c'],
    ['lw_shawaa', 'シャワー', 'しゃわー', 'shower', EN, 'c'],
    ['lw_kicchin', 'キッチン', 'きっちん', 'kitchen', EN, 'c'],
    ['lw_beranda', 'ベランダ', 'べらんだ', 'balcony / veranda', PT],
    ['lw_terasu', 'テラス', 'てらす', 'terrace', FR],
    ['lw_gareeji', 'ガレージ', 'がれーじ', 'garage', EN],
    ['lw_doa', 'ドア', 'どあ', 'door (Western-style)', EN, 'c'],
    ['lw_kaapetto', 'カーペット', 'かーぺっと', 'carpet', EN],
    ['lw_kusshon', 'クッション', 'くっしょん', 'cushion', EN, 'c'],
    ['lw_matto', 'マット', 'まっと', 'mat', EN],
    ['lw_taoru', 'タオル', 'たおる', 'towel', EN, 'c'],
    ['lw_hangaa', 'ハンガー', 'はんがー', 'clothes hanger', EN, 'c'],
    ['lw_shiitsu', 'シーツ', 'しーつ', 'bedsheet', EN],
    ['lw_ribingu', 'リビング', 'りびんぐ', 'living room (clipping)', EN, 'c'],
    ['lw_interia', 'インテリア', 'いんてりあ', 'interior / home furnishings', EN, 'c'],
    ['lw_raito', 'ライト', 'らいと', 'light / lamp', EN, 'c'],
  ],

  // Vehicles + driving. Wasei gems: ハンドル(=steering wheel), パンク(=flat tire),
  // ホーム(=train platform), バイク/オートバイ(=motorcycle), ガソリンスタンド.
  'vehicles': [
    ['lw_baiku', 'バイク', 'ばいく', 'motorcycle (wasei)', EN, 'cw'],
    ['lw_ootobai', 'オートバイ', 'おーとばい', 'motorcycle (wasei)', EN, 'cw'],
    ['lw_torakku', 'トラック', 'とらっく', 'truck', EN, 'c'],
    ['lw_ban', 'バン', 'ばん', 'van', EN],
    ['lw_taiya', 'タイヤ', 'たいや', 'tire', EN, 'c'],
    ['lw_handoru', 'ハンドル', 'はんどる', 'steering wheel (wasei)', EN, 'cw'],
    ['lw_bureeki', 'ブレーキ', 'ぶれーき', 'brake(s)', EN, 'c'],
    ['lw_akuseru', 'アクセル', 'あくせる', 'accelerator (clipping)', EN, 'c'],
    ['lw_gasorin', 'ガソリン', 'がそりん', 'gasoline', EN, 'c'],
    ['lw_panku', 'パンク', 'ぱんく', 'flat tire (wasei, from puncture)', EN, 'cw'],
    ['lw_herumetto', 'ヘルメット', 'へるめっと', 'helmet', EN, 'c'],
    ['lw_kurakushon', 'クラクション', 'くらくしょん', 'car horn', FR],
    ['lw_nanbaa', 'ナンバー', 'なんばー', 'number / license plate', EN, 'c'],
    ['lw_banpaa', 'バンパー', 'ばんぱー', 'bumper', EN],
    ['lw_miraa', 'ミラー', 'みらー', 'mirror', EN, 'c'],
    ['lw_hoomu', 'ホーム', 'ほーむ', 'train platform (wasei clipping)', EN, 'cw'],
    ['lw_erebeetaa', 'エレベーター', 'えれべーたー', 'elevator', EN, 'c'],
    ['lw_esukareetaa', 'エスカレーター', 'えすかれーたー', 'escalator', EN, 'c'],
    ['lw_gasorinsutando', 'ガソリンスタンド', 'がそりんすたんど', 'gas station (wasei)', EN, 'cw'],
  ],

  // Holidays + celebrations (re-tagged プレゼント/ケーキ/バレンタイン/サプライズ too).
  'events': [
    ['lw_kurisumasu', 'クリスマス', 'くりすます', 'Christmas', EN, 'c'],
    ['lw_paatii', 'パーティー', 'ぱーてぃー', 'party', EN, 'c'],
    ['lw_ibento', 'イベント', 'いべんと', 'event', EN, 'c'],
    ['lw_harowin', 'ハロウィン', 'はろうぃん', 'Halloween', EN],
    ['lw_pareedo', 'パレード', 'ぱれーど', 'parade', EN],
    ['lw_kaanibaru', 'カーニバル', 'かーにばる', 'carnival', EN],
    ['lw_seremonii', 'セレモニー', 'せれもにー', 'ceremony', EN],
    ['lw_kauntodaun', 'カウントダウン', 'かうんとだうん', 'countdown', EN],
    ['lw_dekoreeshon', 'デコレーション', 'でこれーしょん', 'decoration', EN],
    ['lw_gesuto', 'ゲスト', 'げすと', 'guest', EN, 'c'],
    ['lw_hosuto', 'ホスト', 'ほすと', 'host', EN],
    ['lw_supiichi', 'スピーチ', 'すぴーち', 'speech', EN, 'c'],
  ],

  // ONLY colors with no native single word. Basic colors stay native: 金色(gold),
  // 銀色(silver), 赤・黄色・紫・緑・茶色. (桃色/橙色 are archaic, so ピンク/オレンジ win.)
  'colors': [
    ['lw_pinku', 'ピンク', 'ぴんく', 'pink', EN, 'c'],
    ['lw_orenji', 'オレンジ', 'おれんじ', 'orange', EN, 'c'],
    ['lw_guree', 'グレー', 'ぐれー', 'grey', EN, 'c'],
    ['lw_beeju', 'ベージュ', 'べーじゅ', 'beige', FR, 'c'],
  ],

  // School life. Wasei gems: カンニング(=cheating, from "cunning"!), サークル(=club),
  // プリント(=handout). ゼミ is from German Seminar. Native 学校・先生・授業 stay.
  'school': [
    ['lw_kanningu', 'カンニング', 'かんにんぐ', 'cheating on a test (wasei)', EN, 'cw'],
    ['lw_saakuru', 'サークル', 'さーくる', 'club / circle (wasei)', EN, 'cw'],
    ['lw_purinto', 'プリント', 'ぷりんと', 'handout (wasei)', EN, 'cw'],
    ['lw_tekisuto', 'テキスト', 'てきすと', 'textbook', EN, 'c'],
    ['lw_zemi', 'ゼミ', 'ぜみ', 'seminar (clipping)', DE],
    ['lw_chooku', 'チョーク', 'ちょーく', 'chalk', EN],
    ['lw_guraundo', 'グラウンド', 'ぐらうんど', 'school grounds / field', EN],
    ['lw_chaimu', 'チャイム', 'ちゃいむ', 'chime / school bell', EN, 'c'],
    ['lw_rokkaa', 'ロッカー', 'ろっかー', 'locker', EN, 'c'],
    ['lw_kurabu', 'クラブ', 'くらぶ', 'club', EN, 'c'],
  ],

  // Shopping. クーポン is French. Native 店・買い物・値段 stay. (カード re-tagged here.)
  'shopping': [
    ['lw_reji', 'レジ', 'れじ', 'checkout / register (clipping)', EN, 'c'],
    ['lw_seeru', 'セール', 'せーる', 'sale', EN, 'c'],
    ['lw_reshiito', 'レシート', 'れしーと', 'receipt', EN, 'c'],
    ['lw_pointo', 'ポイント', 'ぽいんと', 'loyalty points', EN, 'c'],
    ['lw_baagen', 'バーゲン', 'ばーげん', 'bargain sale', EN],
    ['lw_kaato', 'カート', 'かーと', 'shopping cart', EN, 'c'],
    ['lw_shoppingu', 'ショッピング', 'しょっぴんぐ', 'shopping', EN, 'c'],
    ['lw_katarogu', 'カタログ', 'かたろぐ', 'catalog', EN],
    ['lw_kuupon', 'クーポン', 'くーぽん', 'coupon', FR, 'c'],
    ['lw_sutokku', 'ストック', 'すとっく', 'stock / inventory', EN],
  ],

  // Stationery. Wasei gems: ホチキス(=stapler, from brand Hotchkiss!), シャーペン
  // (=mechanical pencil), ボールペン, カッター(=box cutter). (ペン/ファイル re-tagged.)
  'stationery': [
    ['lw_hochikisu', 'ホチキス', 'ほちきす', 'stapler (wasei, from brand)', EN, 'cw'],
    ['lw_shaapen', 'シャーペン', 'しゃーぺん', 'mechanical pencil (wasei)', EN, 'cw'],
    ['lw_boorupen', 'ボールペン', 'ぼーるぺん', 'ballpoint pen (wasei)', EN, 'c'],
    ['lw_kurippu', 'クリップ', 'くりっぷ', 'paper clip', EN, 'c'],
    ['lw_maakaa', 'マーカー', 'まーかー', 'marker', EN, 'c'],
    ['lw_teepu', 'テープ', 'てーぷ', 'tape', EN, 'c'],
    ['lw_kattaa', 'カッター', 'かったー', 'box cutter (wasei)', EN, 'c'],
  ],

  // Card/board games. Wasei gem: トランプ(=playing cards, from "trump"!).
  // (ゲーム/クイズ re-tagged here.)
  'games': [
    ['lw_toranpu', 'トランプ', 'とらんぷ', 'playing cards (wasei)', EN, 'cw'],
    ['lw_pazuru', 'パズル', 'ぱずる', 'puzzle', EN, 'c'],
    ['lw_chesu', 'チェス', 'ちぇす', 'chess', EN],
    ['lw_jookaa', 'ジョーカー', 'じょーかー', 'joker (card)', EN],
    ['lw_daisu', 'ダイス', 'だいす', 'dice', EN],
    ['lw_boodogeemu', 'ボードゲーム', 'ぼーどげーむ', 'board game', EN],
  ],
};

// ── Merge ────────────────────────────────────────────────────────────────────
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;

const data = JSON.parse(await readFile(path.join(ROOT, FILE), 'utf8'));
const byId = new Map((data.loanwords || []).map(w => [w.id, w]));
const before = byId.size;

for (const [genre, rows] of Object.entries(BATCHES)) {
  if (only && genre !== only) continue;
  let added = 0, updated = 0;
  for (const [id, surface, reading, meaning, origin, flags, note] of rows) {
    // BATCHES are the source of truth for lw_* fields — rebuild each run so
    // edits (re-scoped meaning, theme, origin) take effect. Preserve baked
    // tokens only when the surface is unchanged (else derive regenerates).
    // flags string: 'c'=common (everyday), 'w'=wasei-eigo (made-in-Japan English).
    const common = !!flags && flags.includes('c');
    const wasei = !!flags && flags.includes('w');
    const prev = byId.get(id);
    const themes = [...new Set(common ? [genre, 'slice-of-life'] : [genre])];
    const entry = { id, surface, reading, meaning, origin, gtype: 'noun', themes };
    if (common) entry.tier = 'common';
    if (wasei) entry.wasei = true;                    // wasei-eigo (made-in-Japan English)
    if (note) entry.notes = note;                     // etymology note (country names)
    if (prev && prev.surface === surface && prev.reading === reading && prev.tokens) entry.tokens = prev.tokens;
    if (!prev) added++; else updated++;
    byId.set(id, entry);
  }
  if (!only || genre === only) console.log(`[${genre}] +${added} new, ${updated} updated (batch size ${rows.length})`);
}

// Apply RETAG: add extra themes to existing entries (idempotent, deduped).
for (const [id, extra] of Object.entries(RETAG)) {
  const e = byId.get(id);
  if (e) e.themes = [...new Set([...(e.themes || []), ...extra])];
}

// Prune (full runs only): the seed BATCHES are the source of truth for `lw_*`
// ids — drop any pool entry whose id is `lw_*` but no longer authored (e.g. a
// stopgap removed from a batch). Migrated `v_*` ids and anything else are kept.
if (!only) {
  const authored = new Set(Object.values(BATCHES).flat().map(r => r[0]));
  let pruned = 0;
  for (const id of [...byId.keys()]) {
    if (id.startsWith('lw_') && !authored.has(id)) { byId.delete(id); pruned++; }
  }
  if (pruned) console.log(`[prune] removed ${pruned} de-authored lw_* entries`);
}

const loanwords = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(path.join(ROOT, FILE), JSON.stringify({ contentVersion: data.contentVersion || '1.0.0', loanwords }, null, 2) + '\n', 'utf8');
console.log(`\nPool: ${before} → ${loanwords.length} loanwords.`);
console.log('Next: node scripts/derive-glossary-tokens.mjs');
