/* Water sort — the rules of the game, with no screen attached.
 *
 * A vial is an array of colour ids, bottom first:
 *
 *      [2, 1, 1]        top of the vial is the LAST element
 *       ^ bottom
 *
 * A board is an array of vials. Everything here is pure: given a board you
 * get answers or a new board, never a mutation. That is what lets the solver
 * explore thousands of positions safely and the game replay a move list to
 * rebuild any position exactly.
 */
(function (Portal) {
  'use strict';

  var CAPACITY = 4; // units per vial, and units of each colour in the puzzle

  function top(vial) {
    return vial.length ? vial[vial.length - 1] : null;
  }

  /* How many units of the same colour sit on top, as one pourable run. */
  function topRun(vial) {
    if (!vial.length) return 0;
    var colour = vial[vial.length - 1];
    var n = 1;
    for (var i = vial.length - 2; i >= 0; i--) {
      if (vial[i] !== colour) break;
      n++;
    }
    return n;
  }

  function isUniform(vial) {
    return vial.length > 0 && topRun(vial) === vial.length;
  }

  /* A vial is finished when it is empty, or holds a full set of one colour.
   * Uniform-but-not-full doesn't count: the rest of that colour is still
   * stranded somewhere else. */
  function vialDone(vial, capacity) {
    return vial.length === 0 || (isUniform(vial) && vial.length === capacity);
  }

  function isSolved(board, capacity) {
    capacity = capacity || CAPACITY;
    for (var i = 0; i < board.length; i++) {
      if (!vialDone(board[i], capacity)) return false;
    }
    return true;
  }

  function canPour(board, from, to, capacity) {
    capacity = capacity || CAPACITY;
    if (from === to) return false;
    var a = board[from], b = board[to];
    if (!a || !b) return false;
    if (a.length === 0) return false;          // nothing to pour
    if (b.length >= capacity) return false;    // nowhere to put it
    if (b.length === 0) return true;           // any colour may start a vial
    return top(a) === top(b);                  // otherwise colours must match
  }

  /* How many units a pour would actually move. The player never chooses this:
   * as much of the run as fits, goes. */
  function pourAmount(board, from, to, capacity) {
    capacity = capacity || CAPACITY;
    if (!canPour(board, from, to, capacity)) return 0;
    return Math.min(topRun(board[from]), capacity - board[to].length);
  }

  /* Returns a NEW board with the pour applied, or null if it isn't legal. */
  function pour(board, from, to, capacity) {
    capacity = capacity || CAPACITY;
    var n = pourAmount(board, from, to, capacity);
    if (n === 0) return null;
    var next = board.map(function (v) { return v.slice(); });
    var moved = next[from].splice(next[from].length - n, n);
    next[to] = next[to].concat(moved);
    return next;
  }

  /* Every legal pour, minus the ones that provably cannot help:
   *
   *  - Emptying an already-tidy vial into an empty one just slides the
   *    problem sideways, and lets a search wander forever between two
   *    equivalent positions.
   *  - Pouring out of a finished vial undoes work for no reason.
   */
  function moves(board, capacity) {
    capacity = capacity || CAPACITY;
    var list = [];
    for (var from = 0; from < board.length; from++) {
      var a = board[from];
      if (!a.length) continue;
      if (vialDone(a, capacity)) continue;
      for (var to = 0; to < board.length; to++) {
        if (!canPour(board, from, to, capacity)) continue;
        if (board[to].length === 0 && isUniform(a)) continue;
        list.push({ from: from, to: to });
      }
    }
    return list;
  }

  /* Two boards that differ only in which shelf a vial sits on are the same
   * puzzle. Sorting the vials before hashing collapses those into one state,
   * which is most of what keeps the solver fast. */
  function canonical(board) {
    return board.map(function (v) { return v.join(','); }).sort().join('|');
  }

  function clone(board) {
    return board.map(function (v) { return v.slice(); });
  }

  /* Rebuild a position by replaying moves from the starting board. This is
   * how a saved game is restored and how undo works: there is only ever one
   * source of truth, the move list. */
  function replay(startBoard, moveList, capacity) {
    capacity = capacity || CAPACITY;
    var board = clone(startBoard);
    for (var i = 0; i < moveList.length; i++) {
      var next = pour(board, moveList[i].from, moveList[i].to, capacity);
      if (!next) return null; // move list doesn't match this board
      board = next;
    }
    return board;
  }

  Portal.watersort = Portal.watersort || {};
  Portal.watersort.rules = {
    CAPACITY: CAPACITY,
    top: top,
    topRun: topRun,
    isUniform: isUniform,
    vialDone: vialDone,
    isSolved: isSolved,
    canPour: canPour,
    pourAmount: pourAmount,
    pour: pour,
    moves: moves,
    canonical: canonical,
    clone: clone,
    replay: replay
  };
})(window.Portal = window.Portal || {});
