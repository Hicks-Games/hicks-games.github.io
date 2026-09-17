/* Untangle — building a board that is guaranteed to come apart.
 *
 * The trick is to build the finished picture first and then muddle it:
 *
 *   1. Punch holes in a jittered grid, so no two are ever closer than a
 *      thumb's width apart.
 *   2. Join pegs with strings, shortest first, refusing any string that would
 *      cross one already drawn or pass straight through another peg. Built
 *      that way, the picture has no crossings at all — it is the solved
 *      board, and we haven't had to search for it.
 *   3. Shuffle which peg sits in which hole.
 *
 * Putting every peg back in its own hole is therefore always a way out, and
 * since any shuffle can be undone by swapping pegs two at a time, he can
 * always get there. The tests check the finished picture really is untangled
 * rather than taking this paragraph's word for it.
 */
(function (Portal) {
  'use strict';

  var R = Portal.untangle.rules;

  /* Difficulty is how many pegs and strings, nothing else. The ceiling is set
   * by his thumb, not by taste: holes have to stay at least 68px apart on a
   * 360px screen, and there is only so much room. */
  var PRESETS = {
    gentle: { pegs: 6,  spares: 2, name: 'Gentle' },
    easy:   { pegs: 8,  spares: 2, name: 'Easy' },
    medium: { pegs: 10, spares: 2, name: 'Medium' },
    hard:   { pegs: 12, spares: 2, name: 'Hard' }
  };

  var MIN_GAP = 68;      // px between hole centres: one tap target, edge to edge
  var CLEARANCE = 26;    // px a string must keep from any peg it isn't tied to

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

  /* Holes on a jittered grid. A plain grid would put three pegs in a dead
   * straight line, where a string through the middle one is indistinguishable
   * from two strings meeting there. The jitter breaks that up while keeping
   * every hole a safe distance from its neighbours. */
  function punchHoles(count, width, height, random) {
    var margin = 34;
    var usableW = width - margin * 2;
    var usableH = height - margin * 2;

    /* Choose a grid that uses most of its cells, so the pegs end up spread
     * over the whole board instead of clumped in one corner with a bare patch
     * beside them. Squarish cells, nudged towards more columns because the
     * board is much taller than it is wide.
     *
     * Cells are never smaller than MIN_GAP in either direction. That is what
     * makes the spacing guarantee hold: one peg per cell, jitter kept to half
     * the spare room, so two pegs either side of any boundary stay at least
     * MIN_GAP apart. */
    var colsMax = Math.max(1, Math.floor(usableW / MIN_GAP));
    var rowsMax = Math.max(1, Math.floor(usableH / MIN_GAP));
    if (colsMax * rowsMax < count) return null;   // genuinely not enough board

    var cols = Math.round(Math.sqrt(count * usableW / usableH) * 1.3);
    cols = Math.max(1, Math.min(colsMax, cols));
    var rows = Math.ceil(count / cols);
    while (rows > rowsMax && cols < colsMax) {
      cols++;
      rows = Math.ceil(count / cols);
    }
    if (rows > rowsMax) return null;

    var cellW = usableW / cols;
    var cellH = usableH / rows;

    // Half the spare room in each direction, so a peg can never wander close
    // enough to its neighbour for his thumb to hit the wrong one.
    var jitterX = Math.max(0, (cellW - MIN_GAP) / 2);
    var jitterY = Math.max(0, (cellH - MIN_GAP) / 2);

    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) cells.push({ r: r, c: c });
    }
    shuffle(cells, random);
    cells = cells.slice(0, count);

    return cells.map(function (cell) {
      return {
        x: margin + cell.c * cellW + cellW / 2 + (random() * 2 - 1) * jitterX,
        y: margin + cell.r * cellH + cellH / 2 + (random() * 2 - 1) * jitterY
      };
    });
  }

  /* Join the pegs without a single crossing, shortest strings first. */
  function drawStrings(points, pegCount, target) {
    var candidates = [];
    for (var i = 0; i < pegCount; i++) {
      for (var j = i + 1; j < pegCount; j++) {
        candidates.push({
          a: i, b: j,
          d: Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
        });
      }
    }
    candidates.sort(function (m, n) { return m.d - n.d; });

    var edges = [];
    for (var k = 0; k < candidates.length && edges.length < target; k++) {
      var cand = candidates[k];
      var p1 = points[cand.a], p2 = points[cand.b];

      // Would it run straight through some other peg?
      var blocked = false;
      for (var p = 0; p < pegCount && !blocked; p++) {
        if (p === cand.a || p === cand.b) continue;
        if (R.distanceToSegment(points[p], p1, p2) < CLEARANCE) blocked = true;
      }
      if (blocked) continue;

      // Would it cross a string already drawn?
      for (var e = 0; e < edges.length && !blocked; e++) {
        var ex = edges[e];
        if (ex[0] === cand.a || ex[0] === cand.b ||
            ex[1] === cand.a || ex[1] === cand.b) continue;
        if (R.segmentsCross(p1, p2, points[ex[0]], points[ex[1]])) blocked = true;
      }
      if (blocked) continue;

      edges.push([cand.a, cand.b]);
    }
    return edges;
  }

  /* Every peg needs a string, or it is just scenery he can't tell is finished. */
  function allConnected(edges, pegCount) {
    if (pegCount === 0) return true;
    var adjacency = {};
    edges.forEach(function (e) {
      (adjacency[e[0]] = adjacency[e[0]] || []).push(e[1]);
      (adjacency[e[1]] = adjacency[e[1]] || []).push(e[0]);
    });
    var seen = {}, stack = [0], count = 0;
    while (stack.length) {
      var v = stack.pop();
      if (seen[v]) continue;
      seen[v] = true;
      count++;
      (adjacency[v] || []).forEach(function (w) { if (!seen[w]) stack.push(w); });
    }
    return count === pegCount;
  }

  /* generate({ difficulty, seed, width, height })
   *
   * width/height are the board area in px, needed because "far enough apart"
   * is a fact about his thumb, not about arbitrary units. Positions come back
   * as fractions of that area so the board can be drawn at any size later.
   */
  function generate(options) {
    options = options || {};
    var preset = PRESETS[options.difficulty] || PRESETS.easy;
    var pegs = options.pegs || preset.pegs;
    var spares = options.spares === undefined ? preset.spares : options.spares;
    var width = options.width || 332;
    var height = options.height || 560;

    var seed = options.seed === undefined
      ? (Math.random() * 0xFFFFFFFF) >>> 0
      : options.seed >>> 0;
    var random = rng(seed);

    /* If the board is too small for the pegs asked for — a short screen, or
     * the address bar taking a slice — quietly play with fewer rather than
     * failing. A slightly smaller puzzle is a puzzle; an error screen is not.
     */
    for (var count = pegs; count >= 4; count--) {
      var built = build(count, spares, width, height, random, options);
      if (built) return built;
    }

    throw new Error('untangle: could not build a board for ' + pegs + ' pegs');
  }

  function build(pegs, spares, width, height, random, options) {
    var preset = PRESETS[options.difficulty] || PRESETS.easy;
    var holeCount = pegs + spares;

    for (var attempt = 0; attempt < 120; attempt++) {
      var points = punchHoles(holeCount, width, height, random);
      if (!points) return null;      // no room at this size; caller tries fewer

      // Pegs live in the first `pegs` holes in the solved picture; the spares
      // are the empty places he has to work with.
      // Enough strings to make a real tangle, few enough that the board stays
      // readable. A dense web is not a harder puzzle for him, just a noisier
      // picture. (3n-6 is as many as any flat drawing can hold without
      // crossings, so never ask for more than that.)
      var target = Math.min(Math.round(pegs * 1.5), 3 * pegs - 6);
      var edges = drawStrings(points, pegs, Math.max(pegs, target));
      if (edges.length < pegs || !allConnected(edges, pegs)) continue;

      var solved = [];
      for (var h = 0; h < holeCount; h++) solved.push(h < pegs ? h : null);

      // Belt and braces: the picture we just built must genuinely have no
      // crossings. If this ever fails the geometry is wrong, and it is far
      // better to find out here than on his phone.
      if (!R.isSolved(points, solved, edges)) continue;

      // Muddle it, and insist the result is properly tangled rather than
      // nearly finished already.
      for (var tries = 0; tries < 60; tries++) {
        var start = shuffle(solved.slice(), random);
        var mess = R.countTangled(points, start, edges);
        if (mess < Math.max(3, Math.round(edges.length * 0.35))) continue;

        var holes = points.map(function (p) {
          return { x: p.x / width, y: p.y / height };
        });
        return {
          holes: holes,
          edges: edges,
          start: start,
          solved: solved,
          pegs: pegs,
          spares: spares,
          tangledAtStart: mess,
          seed: options.seed === undefined ? 0 : options.seed >>> 0,
          difficulty: options.difficulty || 'easy',
          name: preset.name
        };
      }
    }

    return null;
  }

  Portal.untangle.generator = {
    generate: generate,
    PRESETS: PRESETS,
    MIN_GAP: MIN_GAP,
    _punchHoles: punchHoles,
    _drawStrings: drawStrings
  };
})(window.Portal = window.Portal || {});
