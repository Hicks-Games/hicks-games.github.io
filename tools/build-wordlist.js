/* Authoring tool. Run by hand, never shipped to the page.
 *
 *   node tools/build-wordlist.js
 *
 * Builds words/wordlist.js from two public lists:
 *
 *   - Google's 10,000 most common English words, swears already removed
 *     https://github.com/first20hours/google-10000-english
 *   - ENABLE, a proper dictionary
 *     https://github.com/dolph/dictionary
 *
 * Neither alone is right. The frequency list is drawn from web text, so it
 * carries "http", "faq", "pdf" and similar; the dictionary carries 170,000
 * words including thousands nobody has ever said out loud. A word has to be
 * in both to count: real, and actually used.
 *
 * That matters more here than it would in a crossword app. A puzzle that
 * expects him to produce OTIOSE is not a harder puzzle, it is a puzzle that
 * blames him for not knowing a word he has no reason to know.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMMON = path.join(ROOT, '.build', 'common.txt');
const DICT = path.join(ROOT, '.build', 'enable.txt');
const OUT = path.join(ROOT, 'words', 'wordlist.js');

const MIN_LEN = 3;
const MAX_LEN = 7;
const MIN_FINDABLE = 10;   // fewer than this is a thin puzzle
const MAX_FINDABLE = 24;   // more than this will not fit on screen as slots

/* Anything crude or unkind that survived the other two lists. The frequency
 * list has had swears taken out already; this is for the rest — slurs,
 * bodily crudeness, and words that would be miserable to meet in a game
 * meant to be restful. */
const BLOCKED = new Set([
  'damn', 'hell', 'crap', 'butt', 'fart', 'turd', 'puke', 'vomit', 'snot',
  'idiot', 'moron', 'stupid', 'dumb', 'loser', 'fool', 'ugly', 'hate',
  'kill', 'dead', 'death', 'died', 'dies', 'dying', 'murder', 'suicide',
  'corpse', 'grave', 'tomb', 'coffin', 'funeral', 'cancer', 'tumor',
  'disease', 'dementia', 'senile', 'demented', 'insane', 'crazy', 'mad',
  'sick', 'ill', 'pain', 'agony', 'sore', 'wound', 'blood', 'gore',
  'nude', 'naked', 'sexy', 'sex', 'sexual', 'porn', 'rape', 'whore',
  'slut', 'bitch', 'bastard', 'jerk', 'creep', 'freak', 'gross'
]);

/* Technically valid, but not words he would ever reach for.
 *
 * Both source lists let this class through and neither can filter it: the
 * dictionary is a Scrabble list, so it takes dialect and archaic forms, while
 * the frequency list is built from web pages, so acronyms rank absurdly high
 * ("mon" is the 1,107th most common string on the web; "norm", an ordinary
 * word, is 9,570th). Frequency is therefore no help here, and these were
 * picked out by reading the short-word list rather than by a rule.
 *
 * Kept deliberately: bob, don, sue, ted, pat, may, mar, ray, jay — each is an
 * ordinary word as well as a name.
 */
const NOT_REALLY_WORDS = new Set([
  // abbreviations and units
  'abs', 'ads', 'alt', 'amp', 'biz', 'dev', 'dis', 'dos', 'dui', 'eng',
  'ids', 'ins', 'las', 'lat', 'mas', 'mem', 'mil', 'mod', 'ons', 'pac',
  'pix', 'rec', 'reg', 'rep', 'res', 'rev', 'sen', 'ser', 'sim', 'sox',
  'tel', 'ups', 'var', 'vol', 'sec', 'admin', 'apps', 'blog', 'faq',
  'html', 'http', 'info', 'jpeg', 'jpg', 'pdf', 'png', 'url', 'www',
  // acronyms read as words
  'rom', 'ram', 'cpu', 'dvd', 'gps', 'usb', 'psi', 'phi', 'chi',
  // names and places
  'ala', 'ana', 'ben', 'dee', 'del', 'jun', 'kay', 'ken', 'mac', 'mae',
  'mel', 'pam', 'nam', 'sri', 'joe', 'kent', 'ohio', 'iowa', 'utah',
  // dialect, archaic, or simply never said
  'col', 'cos', 'dom', 'eau', 'gnu', 'hon', 'leu', 'mon', 'sic', 'sol',
  'til', 'ala', 'ave'
]);

function read(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(Boolean);
}

function counts(word) {
  const c = new Uint8Array(26);
  for (const ch of word) c[ch.charCodeAt(0) - 97]++;
  return c;
}

/* Can `word` be spelled from the letters of `base`, using each tile at most
 * as many times as it appears? */
function fits(wordCounts, baseCounts) {
  for (let i = 0; i < 26; i++) if (wordCounts[i] > baseCounts[i]) return false;
  return true;
}

function main() {
  const common = new Set(read(COMMON));
  const dict = new Set(read(DICT));

  const words = [...common]
    .filter(w =>
      w.length >= MIN_LEN && w.length <= MAX_LEN &&
      /^[a-z]+$/.test(w) &&
      dict.has(w) &&
      !BLOCKED.has(w) &&
      !NOT_REALLY_WORDS.has(w))
    .sort();

  console.log(`playable words: ${words.length}`);

  const wordCounts = words.map(counts);

  // Candidate letter sets: the longest words in the list. A base word is only
  // kept if it yields a sensible number of shorter words — enough to work at,
  // few enough to show on screen at once.
  const bases = [];
  const histogram = {};
  for (let i = 0; i < words.length; i++) {
    const base = words[i];
    if (base.length < 6) continue;
    if (new Set(base).size < 4) continue;      // too few distinct letters
    const baseCounts = wordCounts[i];
    let findable = 0;
    for (let j = 0; j < words.length; j++) {
      if (words[j].length > base.length) continue;
      if (fits(wordCounts[j], baseCounts)) findable++;
    }
    if (findable >= MIN_FINDABLE && findable <= MAX_FINDABLE) {
      bases.push(base);
      histogram[findable] = (histogram[findable] || 0) + 1;
    }
  }

  console.log(`usable letter sets: ${bases.length}`);
  console.log('findable-word spread:',
    Object.keys(histogram).sort((a, b) => a - b)
      .map(k => `${k}:${histogram[k]}`).join(' '));

  const body = `/* Generated by tools/build-wordlist.js — do not edit by hand.
 *
 * Every word here is both a real dictionary word (ENABLE) and one of the
 * ten thousand most common words in English, with anything crude or unkind
 * removed. A word game for someone with Alzheimer's has no business
 * expecting words he has no reason to know.
 *
 *   ${words.length} playable words, ${MIN_LEN}-${MAX_LEN} letters
 *   ${bases.length} letter sets, each yielding ${MIN_FINDABLE}-${MAX_FINDABLE} words
 */
(function (Portal) {
  'use strict';
  Portal.words = Portal.words || {};
  Portal.words.list = {
    MIN_LEN: ${MIN_LEN},
    MAX_LEN: ${MAX_LEN},
    WORDS: ${JSON.stringify(words)},
    BASES: ${JSON.stringify(bases)}
  };
})(window.Portal = window.Portal || {});
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`wrote ${OUT} (${kb}KB)`);
}

main();
