/* Word game — choosing a set of letters worth playing with.
 *
 * Every candidate letter set was checked when the dictionary was built: it
 * spells between ten and twenty-four real, common words. So there is nothing
 * to search for and nothing to verify here — pick one, shuffle its letters so
 * the word it came from isn't sitting there in plain sight, and work out what
 * it spells.
 */
(function (Portal) {
  'use strict';

  var R = Portal.words.rules;

  /* Difficulty is how many tiles, and how much there is to find. */
  var PRESETS = {
    gentle: { letters: 6, min: 10, max: 14, name: 'Gentle' },
    easy:   { letters: 6, min: 12, max: 18, name: 'Easy' },
    medium: { letters: 7, min: 14, max: 20, name: 'Medium' },
    hard:   { letters: 7, min: 18, max: 24, name: 'Hard' }
  };

  function rng(seed) {
    var a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, random) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* generate({ difficulty, seed })
   *
   * Returns { letters, findable, target, ... }. `letters` is shuffled; the
   * word the tiles came from is one of the words to find, not a label.
   */
  function generate(options) {
    options = options || {};
    var preset = PRESETS[options.difficulty] || PRESETS.easy;
    var wanted = options.letters || preset.letters;
    var min = options.min === undefined ? preset.min : options.min;
    var max = options.max === undefined ? preset.max : options.max;

    var seed = options.seed === undefined
      ? (Math.random() * 0xFFFFFFFF) >>> 0
      : options.seed >>> 0;
    var random = rng(seed);

    var list = Portal.words.list;
    var bases = list.BASES;

    // Walk the candidates from a random starting point rather than filtering
    // the whole set: the same result, without building a copy of it.
    var start = Math.floor(random() * bases.length);
    var fallback = null;

    for (var step = 0; step < bases.length; step++) {
      var base = bases[(start + step) % bases.length];
      if (base.length !== wanted) continue;

      var letters = shuffle(base.split(''), random);
      var findable = R.findableFrom(letters, list.WORDS);
      if (findable.length < min || findable.length > max) {
        // Right length, wrong amount to find. Worth keeping in case nothing
        // better turns up.
        if (!fallback && findable.length >= 8) {
          fallback = { letters: letters, findable: findable };
        }
        continue;
      }

      return build(letters, findable, seed, options, preset);
    }

    if (fallback) return build(fallback.letters, fallback.findable, seed, options, preset);
    throw new Error('word game: no letter set of ' + wanted + ' letters fits');
  }

  function build(letters, findable, seed, options, preset) {
    return {
      letters: letters,
      findable: findable,
      target: R.target(findable.length),
      seed: seed,
      difficulty: options.difficulty || 'easy',
      name: preset.name
    };
  }

  Portal.words.generator = {
    generate: generate,
    PRESETS: PRESETS
  };
})(window.Portal = window.Portal || {});
