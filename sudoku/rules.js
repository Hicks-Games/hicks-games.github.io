/* Sudoku — the rules, with no screen attached.
 *
 * A grid is a flat array of numbers, row by row, with 0 for an empty square.
 * Everything is written for an n x n grid divided into boxes boxW wide and
 * boxH tall, so the same code plays the full 9x9 game and the gentler 4x4 and
 * 6x6 versions without a second implementation to keep in step.
 *
 *   4x4  boxes 2 wide, 2 tall
 *   6x6  boxes 3 wide, 2 tall
 *   9x9  boxes 3 wide, 3 tall   — the one he knows
 *
 * As everywhere else in the portal, the grid on screen is never stored. What
 * is stored is the puzzle he started from and every number he has put in, and
 * the grid is rebuilt from those.
 */
(function (Portal) {
  'use strict';

  function boxOf(index, n, boxW, boxH) {
    var r = Math.floor(index / n), c = index % n;
    return Math.floor(r / boxH) * (n / boxW) + Math.floor(c / boxW);
  }

  /* Every square that shares a row, a column or a box with this one — the
   * squares whose numbers it is not allowed to repeat. */
  function peers(index, n, boxW, boxH) {
    var r = Math.floor(index / n), c = index % n;
    var box = boxOf(index, n, boxW, boxH);
    var out = [];
    for (var i = 0; i < n * n; i++) {
      if (i === index) continue;
      if (Math.floor(i / n) === r || i % n === c ||
          boxOf(i, n, boxW, boxH) === box) {
        out.push(i);
      }
    }
    return out;
  }

  function isComplete(grid) {
    for (var i = 0; i < grid.length; i++) if (!grid[i]) return false;
    return true;
  }

  /* Which squares hold a number that appears twice in the same row, column or
   * box. Shown to him only when the grid is full — see the game screen — so
   * that a finished grid can explain itself rather than just failing to
   * celebrate. */
  function conflicts(grid, n, boxW, boxH) {
    var bad = {};
    for (var i = 0; i < grid.length; i++) {
      if (!grid[i]) continue;
      var group = peers(i, n, boxW, boxH);
      for (var k = 0; k < group.length; k++) {
        if (grid[group[k]] === grid[i]) {
          bad[i] = true;
          bad[group[k]] = true;
        }
      }
    }
    return bad;
  }

  function matchesSolution(grid, solution) {
    for (var i = 0; i < solution.length; i++) {
      if (grid[i] !== solution[i]) return false;
    }
    return true;
  }

  /* A puzzle is finished when every square is filled and every square is
   * right. Since the puzzle was built with exactly one answer, those are the
   * same thing — but checking against the answer is cheaper and says so
   * plainly. */
  function isSolved(grid, solution) {
    return isComplete(grid) && matchesSolution(grid, solution);
  }

  /* Rebuild the grid from the puzzle plus every number he has written.
   * A move writing over one of the puzzle's own numbers is refused, which is
   * how a save that doesn't belong to this puzzle gets caught. */
  function replay(givens, moveList) {
    var grid = givens.slice();
    for (var i = 0; i < moveList.length; i++) {
      var m = moveList[i];
      if (m.cell < 0 || m.cell >= grid.length) return null;
      if (givens[m.cell]) return null;
      grid[m.cell] = m.value;
    }
    return grid;
  }

  Portal.sudoku = Portal.sudoku || {};
  Portal.sudoku.rules = {
    boxOf: boxOf,
    peers: peers,
    isComplete: isComplete,
    conflicts: conflicts,
    matchesSolution: matchesSolution,
    isSolved: isSolved,
    replay: replay
  };
})(window.Portal = window.Portal || {});
