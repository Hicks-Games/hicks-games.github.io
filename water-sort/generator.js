/* Water sort — making puzzles that are guaranteed to be finishable.
 *
 * The board is dealt the way the real game deals it: shuffle every unit of
 * every colour together, fill each colour vial to the brim, and leave exactly
 * two vials empty. That opening shape matters more than it looks. Dad has
 * played this game for years; a board that starts with half-filled vials is
 * subtly not the game he knows, and "subtly not the game he knows" is the
 * thing this whole portal exists to avoid.
 *
 * (An earlier version built boards by running the rules backwards from a
 * finished puzzle. Those boards were legal and solvable, but they came out
 * with liquid split across partly-filled vials, because a pour splits runs
 * unevenly. Correct, and wrong.)
 *
 * A shuffled deal is not automatically finishable, so nothing is handed out
 * until the solver has actually found a way through it. That solved route is
 * stored with the puzzle, and the test harness replays it to prove the
 * promise printed on the screen.
 */
(function (Portal) {
  'use strict';

  var R = Portal.watersort.rules;

  /* Difficulty is how many colours are in play, and nothing else. No timers,
   * no tricks, no scoring. */
  var PRESETS = {
    gentle: { colours: 3, empties: 2 },
    easy:   { colours: 4, empties: 2 },
    medium: { colours: 6, empties: 2 },
    hard:   { colours: 8, empties: 2 }
  };

  /* A small seedable random number generator, so a puzzle that misbehaves can
   * be reproduced exactly from its seed instead of "it happened once". */
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
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  /* Deal every unit of every colour into full vials, then add the empty ones
   * the player works with. */
  function deal(colours, empties, capacity, random) {
    var pool = [];
    for (var c = 0; c < colours; c++) {
      for (var n = 0; n < capacity; n++) pool.push(c);
    }
    shuffle(pool, random);

    var board = [];
    for (var v = 0; v < colours; v++) {
      board.push(pool.slice(v * capacity, (v + 1) * capacity));
    }
    for (var e = 0; e < empties; e++) board.push([]);
    return board;
  }

  /* generate({ difficulty | colours, empties, seed })
   *
   * Returns { board, solution, colours, empties, capacity, seed, difficulty }.
   * Throws rather than returning a puzzle it could not verify — a thrown error
   * is a bug someone fixes, a silently unfinishable puzzle is Dad believing he
   * failed.
   */
  function generate(options) {
    options = options || {};
    var preset = PRESETS[options.difficulty] || PRESETS.easy;
    var colours = options.colours || preset.colours;
    var empties = options.empties === undefined ? preset.empties : options.empties;
    var capacity = options.capacity || R.CAPACITY;
    var budget = options.budget || Portal.watersort.solver.DEFAULT_BUDGET;

    var seed = options.seed === undefined
      ? (Math.random() * 0xFFFFFFFF) >>> 0
      : options.seed >>> 0;
    var random = rng(seed);

    /* A shuffle can land on a board that cannot be finished, or one that is
     * so nearly sorted it isn't a puzzle. Both just get dealt again. */
    var minMoves = options.minMoves === undefined ? colours : options.minMoves;

    for (var attempt = 0; attempt < 200; attempt++) {
      var board = deal(colours, empties, capacity, random);
      if (R.isSolved(board, capacity)) continue;

      var result = Portal.watersort.solver.solve(board, capacity, budget);
      if (!result.solved) continue;
      if (result.moves.length < minMoves) continue;

      return {
        board: board,
        solution: result.moves,
        colours: colours,
        empties: empties,
        capacity: capacity,
        seed: seed,
        difficulty: options.difficulty || 'easy'
      };
    }

    throw new Error(
      'water sort: could not deal a verified puzzle for ' +
      colours + ' colours after 200 attempts'
    );
  }

  Portal.watersort.generator = {
    generate: generate,
    PRESETS: PRESETS,
    // exposed for the test page
    _rng: rng,
    _deal: deal
  };
})(window.Portal = window.Portal || {});
