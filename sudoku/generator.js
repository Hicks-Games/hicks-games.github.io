/* Sudoku — building puzzles that have exactly one answer.
 *
 * "Exactly one" is the whole job. A sudoku with two answers is the same
 * betrayal as a water sort that cannot be finished: he follows the logic
 * correctly, arrives somewhere the puzzle won't accept, and concludes that he
 * got it wrong. So every square is only taken away if the puzzle still has a
 * single answer without it, checked by counting solutions rather than
 * assuming.
 *
 * Build order is the usual one: fill a whole grid at random, then take
 * numbers out for as long as the answer stays unique.
 */
(function (Portal) {
  'use strict';

  var R = Portal.sudoku.rules;

  /* Difficulty is the size of the grid and how many numbers he starts with.
   *
   * 9x9 is the game he actually plays, so that is the default. The smaller
   * grids are real variants, not toys — and their squares are much bigger
   * under a shaky finger, which is why they are here as gentler options. */
  var PRESETS = {
    gentle:  { n: 4, boxW: 2, boxH: 2, givens: 8,  name: 'Gentle' },
    easy:    { n: 6, boxW: 3, boxH: 2, givens: 20, name: 'Easy' },
    classic: { n: 9, boxW: 3, boxH: 3, givens: 42, name: 'Classic' },
    hard:    { n: 9, boxW: 3, boxH: 3, givens: 32, name: 'Hard' }
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

  /* Solve by always filling the square with the fewest choices left, tracking
   * what is still allowed in each row, column and box as bits. That is what
   * makes counting solutions cheap enough to do once per square removed.
   *
   * Counting stops as soon as `limit` answers are found: to prove a puzzle is
   * not unique you only ever need to find two.
   */
  function countSolutions(grid, n, boxW, boxH, limit, random) {
    var full = (1 << n) - 1;
    var rows = new Array(n).fill(0);
    var cols = new Array(n).fill(0);
    var boxes = new Array(n).fill(0);
    var work = grid.slice();

    for (var i = 0; i < work.length; i++) {
      if (!work[i]) continue;
      var bit = 1 << (work[i] - 1);
      var r = Math.floor(i / n), c = i % n, b = R.boxOf(i, n, boxW, boxH);
      if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0; // already broken
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }

    var found = 0;

    function step() {
      var bestCell = -1, bestMask = 0, bestCount = n + 1;
      for (var i = 0; i < work.length; i++) {
        if (work[i]) continue;
        var r = Math.floor(i / n), c = i % n, b = R.boxOf(i, n, boxW, boxH);
        var allowed = full & ~(rows[r] | cols[c] | boxes[b]);
        if (allowed === 0) return;                 // a dead end, back up
        var count = 0;
        for (var m = allowed; m; m &= m - 1) count++;
        if (count < bestCount) {
          bestCount = count; bestCell = i; bestMask = allowed;
          if (count === 1) break;                  // cannot do better
        }
      }

      if (bestCell === -1) {                       // nothing empty left
        found++;
        return;
      }

      var values = [];
      for (var v = 1; v <= n; v++) if (bestMask & (1 << (v - 1))) values.push(v);
      if (random) shuffle(values, random);

      var rr = Math.floor(bestCell / n), cc = bestCell % n;
      var bb = R.boxOf(bestCell, n, boxW, boxH);
      for (var k = 0; k < values.length && found < limit; k++) {
        var bitv = 1 << (values[k] - 1);
        work[bestCell] = values[k];
        rows[rr] |= bitv; cols[cc] |= bitv; boxes[bb] |= bitv;
        step();
        rows[rr] &= ~bitv; cols[cc] &= ~bitv; boxes[bb] &= ~bitv;
        work[bestCell] = 0;
      }
    }

    step();
    return found;
  }

  /* A complete, valid grid. Solving an empty grid with the candidate order
   * shuffled gives a different one every time. */
  function fullGrid(n, boxW, boxH, random) {
    var grid = new Array(n * n).fill(0);
    var answer = null;
    var full = (1 << n) - 1;
    var rows = new Array(n).fill(0);
    var cols = new Array(n).fill(0);
    var boxes = new Array(n).fill(0);

    function step() {
      var cell = -1, mask = 0, best = n + 1;
      for (var i = 0; i < grid.length; i++) {
        if (grid[i]) continue;
        var r = Math.floor(i / n), c = i % n, b = R.boxOf(i, n, boxW, boxH);
        var allowed = full & ~(rows[r] | cols[c] | boxes[b]);
        if (!allowed) return false;
        var count = 0;
        for (var m = allowed; m; m &= m - 1) count++;
        if (count < best) { best = count; cell = i; mask = allowed; }
      }
      if (cell === -1) { answer = grid.slice(); return true; }

      var values = [];
      for (var v = 1; v <= n; v++) if (mask & (1 << (v - 1))) values.push(v);
      shuffle(values, random);

      var rr = Math.floor(cell / n), cc = cell % n, bb = R.boxOf(cell, n, boxW, boxH);
      for (var k = 0; k < values.length; k++) {
        var bit = 1 << (values[k] - 1);
        grid[cell] = values[k];
        rows[rr] |= bit; cols[cc] |= bit; boxes[bb] |= bit;
        if (step()) return true;
        rows[rr] &= ~bit; cols[cc] &= ~bit; boxes[bb] &= ~bit;
        grid[cell] = 0;
      }
      return false;
    }

    step();
    return answer;
  }

  /* Take numbers away for as long as exactly one answer survives. */
  function carve(solution, n, boxW, boxH, targetGivens, random) {
    var puzzle = solution.slice();
    var order = [];
    for (var i = 0; i < puzzle.length; i++) order.push(i);
    shuffle(order, random);

    var remaining = puzzle.length;
    for (var k = 0; k < order.length && remaining > targetGivens; k++) {
      var cell = order[k];
      var kept = puzzle[cell];
      puzzle[cell] = 0;
      // Two is all it takes to disqualify it, so never look for a third.
      if (countSolutions(puzzle, n, boxW, boxH, 2) !== 1) {
        puzzle[cell] = kept;      // taking that one away made it ambiguous
      } else {
        remaining--;
      }
    }
    return puzzle;
  }

  /* generate({ difficulty, seed })
   *
   * Returns { n, boxW, boxH, givens, solution, ... }. Throws rather than
   * returning a puzzle whose answer it could not confirm is the only one.
   */
  function generate(options) {
    options = options || {};
    var preset = PRESETS[options.difficulty] || PRESETS.classic;
    var n = options.n || preset.n;
    var boxW = options.boxW || preset.boxW;
    var boxH = options.boxH || preset.boxH;
    var targetGivens = options.givens || preset.givens;

    var seed = options.seed === undefined
      ? (Math.random() * 0xFFFFFFFF) >>> 0
      : options.seed >>> 0;
    var random = rng(seed);

    var solution = fullGrid(n, boxW, boxH, random);
    if (!solution) throw new Error('sudoku: could not build a grid');

    var givens = carve(solution, n, boxW, boxH, targetGivens, random);

    // Belt and braces. If this ever fails the carving is wrong, and finding
    // out here costs nothing while finding out on his phone costs him an
    // afternoon and his confidence.
    if (countSolutions(givens, n, boxW, boxH, 2) !== 1) {
      throw new Error('sudoku: puzzle does not have exactly one answer');
    }

    return {
      n: n,
      boxW: boxW,
      boxH: boxH,
      givens: givens,
      solution: solution,
      seed: seed,
      difficulty: options.difficulty || 'classic',
      name: preset.name || 'Classic'
    };
  }

  Portal.sudoku.generator = {
    generate: generate,
    PRESETS: PRESETS,
    countSolutions: countSolutions,
    _fullGrid: fullGrid,
    _carve: carve
  };
})(window.Portal = window.Portal || {});
