/* Water sort — the solver.
 *
 * This is the machine that keeps the portal's one promise: it is what proves,
 * before a puzzle is ever shown, that the puzzle can actually be finished.
 *
 * Depth-first search with two things that make it fast enough to run on a
 * five-year-old phone:
 *
 *   - a memo of positions already visited, keyed on a canonical form that
 *     ignores which shelf a vial sits on;
 *   - move ordering that tries the obviously-good pours first (finishing a
 *     colour, emptying a vial completely) before the speculative ones.
 *
 * It also runs under a hard budget. Water sort is NP-complete in general, so
 * "search until you find the answer" is not a promise anyone can keep. When
 * the budget runs out the solver says so honestly rather than guessing, and
 * the generator simply throws that candidate away and makes another.
 */
(function (Portal) {
  'use strict';

  var R = Portal.watersort.rules;

  var DEFAULT_BUDGET = 50000; // positions examined
  var MAX_DEPTH = 300;

  /* Rank the moves worth trying first. A pour that completes a colour is
   * almost always progress; a pour that empties a vial frees up the space
   * that makes everything else possible. */
  function score(board, move, capacity) {
    var from = board[move.from], to = board[move.to];
    var amount = R.pourAmount(board, move.from, move.to, capacity);
    var s = 0;
    if (to.length + amount === capacity && R.isUniform(to.concat([R.top(from)]))) {
      s += 100; // finishes a vial
    }
    if (amount === from.length) s += 50;      // empties the source
    if (amount === R.topRun(from)) s += 10;   // moves the whole run, no splitting
    if (to.length === 0) s -= 5;              // using up an empty vial has a cost
    return s;
  }

  /* Returns:
   *   { solved: true,  moves: [...], examined: n }
   *   { solved: false, reason: 'exhausted' | 'budget', examined: n }
   *
   * 'exhausted' is a proof: every reachable position was checked and none of
   * them is a win. 'budget' is an admission: we ran out of time and do not
   * know. The generator treats them the same way (discard the puzzle), but
   * the test page distinguishes them, because a rise in 'budget' results means
   * the difficulty caps need revisiting.
   */
  function solve(board, capacity, budget) {
    capacity = capacity || R.CAPACITY;
    budget = budget || DEFAULT_BUDGET;

    var seen = Object.create(null);
    var examined = 0;
    var path = [];
    var outcome = null;

    function descend(current, depth) {
      if (outcome) return true;
      if (examined >= budget) { outcome = 'budget'; return false; }
      if (depth > MAX_DEPTH) return false;

      examined++;

      if (R.isSolved(current, capacity)) {
        outcome = 'solved';
        return true;
      }

      var key = R.canonical(current);
      if (seen[key]) return false;
      seen[key] = true;

      var options = R.moves(current, capacity);
      options.sort(function (m1, m2) {
        return score(current, m2, capacity) - score(current, m1, capacity);
      });

      for (var i = 0; i < options.length; i++) {
        var move = options[i];
        var next = R.pour(current, move.from, move.to, capacity);
        if (!next) continue;
        path.push(move);
        if (descend(next, depth + 1)) return true;
        path.pop();
        if (outcome === 'budget') return false;
      }
      return false;
    }

    descend(R.clone(board), 0);

    if (outcome === 'solved') {
      return { solved: true, moves: path.slice(), examined: examined };
    }
    return {
      solved: false,
      reason: outcome === 'budget' ? 'budget' : 'exhausted',
      examined: examined
    };
  }

  Portal.watersort.solver = {
    solve: solve,
    DEFAULT_BUDGET: DEFAULT_BUDGET
  };
})(window.Portal = window.Portal || {});
