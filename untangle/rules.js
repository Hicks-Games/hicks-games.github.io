/* Untangle — the rules, with no screen attached.
 *
 * A board is a set of holes at fixed positions, pegs sitting in some of those
 * holes, and strings joining pairs of pegs. A string is tangled if it crosses
 * another string. The puzzle is done when nothing crosses anything.
 *
 *   holes  [{x, y}, ...]        positions, 0..1 of the board's width/height
 *   pegAt  [pegId | null, ...]  which peg is sitting in each hole
 *   edges  [[pegA, pegB], ...]  which pegs are joined by a string
 *
 * Pegs move between holes, so the geometry is worked out fresh each time from
 * where the pegs currently are. As in water sort, the position is never
 * stored: it is replayed from the opening board plus the list of moves.
 */
(function (Portal) {
  'use strict';

  var EPS = 1e-9;

  function orient(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function within(a, b, p) {   // p is known to be on line ab; is it between?
    return p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS &&
           p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
  }

  /* Do two line segments actually cross?
   *
   * Strings that meet at a shared peg are not tangled — that is just the peg —
   * so those pairs are filtered out before this is asked. Everything else is a
   * proper crossing, including two strings that lie along each other, which
   * looks exactly as wrong on screen as an X does. */
  function segmentsCross(p1, p2, p3, p4) {
    var d1 = orient(p3, p4, p1);
    var d2 = orient(p3, p4, p2);
    var d3 = orient(p1, p2, p3);
    var d4 = orient(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    // Collinear touching or overlapping.
    if (Math.abs(d1) < EPS && within(p3, p4, p1)) return true;
    if (Math.abs(d2) < EPS && within(p3, p4, p2)) return true;
    if (Math.abs(d3) < EPS && within(p1, p2, p3)) return true;
    if (Math.abs(d4) < EPS && within(p1, p2, p4)) return true;
    return false;
  }

  /* Where each peg currently is, in board coordinates. */
  function pointsFor(holes, pegAt) {
    var points = [];
    for (var h = 0; h < pegAt.length; h++) {
      if (pegAt[h] !== null && pegAt[h] !== undefined) points[pegAt[h]] = holes[h];
    }
    return points;
  }

  /* Which strings are tangled right now, as a lookup by edge index. */
  function tangled(holes, pegAt, edges) {
    var points = pointsFor(holes, pegAt);
    var bad = {};
    for (var i = 0; i < edges.length; i++) {
      for (var j = i + 1; j < edges.length; j++) {
        var a = edges[i], b = edges[j];
        // Strings meeting at a peg are fine.
        if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
        if (segmentsCross(points[a[0]], points[a[1]], points[b[0]], points[b[1]])) {
          bad[i] = true;
          bad[j] = true;
        }
      }
    }
    return bad;
  }

  function countTangled(holes, pegAt, edges) {
    var bad = tangled(holes, pegAt, edges);
    return Object.keys(bad).length;
  }

  function isSolved(holes, pegAt, edges) {
    return countTangled(holes, pegAt, edges) === 0;
  }

  /* How close a string passes to a peg it isn't attached to. Used when
   * building a puzzle: a string drawn straight through a peg looks like it
   * joins there, and a picture that lies is the one thing this portal
   * genuinely cannot do. */
  function distanceToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 < EPS) return Math.hypot(p.x - a.x, p.y - a.y);
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /* A move takes whatever is in one hole and whatever is in the other, and
   * exchanges them. Moving a peg to an empty hole and swapping two pegs are
   * the same operation, which keeps the rules to one sentence. */
  function swap(pegAt, h1, h2) {
    var next = pegAt.slice();
    var tmp = next[h1];
    next[h1] = next[h2];
    next[h2] = tmp;
    return next;
  }

  function replay(startPegAt, moveList) {
    var pegAt = startPegAt.slice();
    for (var i = 0; i < moveList.length; i++) {
      var m = moveList[i];
      if (m.a < 0 || m.b < 0 || m.a >= pegAt.length || m.b >= pegAt.length) return null;
      if (m.a === m.b) return null;
      if (pegAt[m.a] === null && pegAt[m.b] === null) return null;  // moved nothing
      pegAt = swap(pegAt, m.a, m.b);
    }
    return pegAt;
  }

  Portal.untangle = Portal.untangle || {};
  Portal.untangle.rules = {
    segmentsCross: segmentsCross,
    pointsFor: pointsFor,
    tangled: tangled,
    countTangled: countTangled,
    isSolved: isSolved,
    distanceToSegment: distanceToSegment,
    swap: swap,
    replay: replay
  };
})(window.Portal = window.Portal || {});
