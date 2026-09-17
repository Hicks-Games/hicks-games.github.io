/* Word game — the rules, with no screen attached.
 *
 * A puzzle is a handful of letter tiles and the list of words that can be
 * spelled from them. Each tile is one letter and may be used once, so a base
 * of FLOWERS spells FLOWER but not FOLLOW.
 *
 * As everywhere else, what gets stored is the puzzle and the words he has
 * found, in the order he found them. Everything else is worked out from those.
 */
(function (Portal) {
  'use strict';

  function counts(word) {
    var c = new Array(26);
    for (var i = 0; i < 26; i++) c[i] = 0;
    for (var k = 0; k < word.length; k++) {
      var at = word.charCodeAt(k) - 97;
      if (at >= 0 && at < 26) c[at]++;
    }
    return c;
  }

  /* Can this word be spelled from those letters, using each tile once? */
  function canSpell(wordCounts, tileCounts) {
    for (var i = 0; i < 26; i++) {
      if (wordCounts[i] > tileCounts[i]) return false;
    }
    return true;
  }

  /* Every word in the dictionary that these tiles can spell. */
  function findableFrom(letters, words) {
    var tiles = counts(letters.join(''));
    var out = [];
    for (var i = 0; i < words.length; i++) {
      if (words[i].length > letters.length) continue;
      if (canSpell(counts(words[i]), tiles)) out.push(words[i]);
    }
    return out;
  }

  /* Can the tiles he has left spell this, given the ones already in use?
   * Used by the screen to grey out tiles rather than to judge a word. */
  function spellableWithTiles(word, letters) {
    return canSpell(counts(word), counts(letters.join('')));
  }

  /* The words he has found, rebuilt from the move list. A move naming a word
   * the puzzle does not contain, or one already found, means the save does
   * not belong to this puzzle. */
  function replay(findable, moveList) {
    var found = [];
    for (var i = 0; i < moveList.length; i++) {
      var word = moveList[i].word;
      if (findable.indexOf(word) === -1) return null;
      if (found.indexOf(word) !== -1) return null;
      found.push(word);
    }
    return found;
  }

  /* How many he needs for the celebration. Deliberately not all of them:
   * hunting the last few obscure ones turns a restful game into homework. */
  function target(total) {
    return Math.max(3, Math.ceil(total * 0.4));
  }

  function isSolved(found, total) {
    return found.length >= target(total);
  }

  Portal.words = Portal.words || {};
  Portal.words.rules = {
    counts: counts,
    canSpell: canSpell,
    findableFrom: findableFrom,
    spellableWithTiles: spellableWithTiles,
    replay: replay,
    target: target,
    isSolved: isSolved
  };
})(window.Portal = window.Portal || {});
