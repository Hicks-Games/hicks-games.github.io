/* Untangle — the screen.
 *
 * Tap a peg to lift it, tap a hole to put it down. If that hole already has a
 * peg in it the two change places; the rule is the same either way, so there
 * is only one thing to learn.
 *
 * Tangled strings are drawn red and thick. As he sorts them out the red goes,
 * and when the last of it goes he has won. That is the whole feedback system:
 * no counters, no hints, nothing that appears or speaks.
 */
(function (Portal) {
  'use strict';

  var R = Portal.untangle.rules;
  var G = Portal.untangle.generator;
  var GAME = 'untangle';

  var PEG_R = 24;        // the peg you see
  var HIT_R = 34;        // the circle that listens for a tap: 68px across
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var puzzle = null;
  var moves = [];
  var pegAt = null;      // derived: replay(puzzle.start, moves)
  var selected = null;   // hole index he has lifted a peg from, or null

  var stageEl, svgEl;

  function settings() { return Portal.state.settings(); }

  function difficulty() {
    return settings().untangleDifficulty || 'easy';
  }

  function save() {
    Portal.state.save(GAME, puzzle, moves);
  }

  function boardSize() {
    var box = stageEl.getBoundingClientRect();
    return { w: Math.max(200, box.width), h: Math.max(200, box.height) };
  }

  function newPuzzle() {
    var size = boardSize();
    puzzle = G.generate({
      difficulty: difficulty(),
      width: size.w,
      height: size.h
    });
    moves = [];
    pegAt = puzzle.start.slice();
    selected = null;
    save();
  }

  function restore() {
    var saved = Portal.state.load(GAME);
    if (!saved || !saved.puzzle || !saved.puzzle.holes) return false;

    var rebuilt = R.replay(saved.puzzle.start, saved.moves);
    if (!rebuilt) return false;
    // Already finished before he put it down: give him a new one rather than
    // a board with nothing left to do.
    if (R.isSolved(saved.puzzle.holes, rebuilt, saved.puzzle.edges)) return false;

    puzzle = saved.puzzle;
    moves = saved.moves;
    pegAt = rebuilt;
    selected = null;
    return true;
  }

  // ------------------------------------------------------------- rendering

  function screenHoles() {
    var size = boardSize();
    return puzzle.holes.map(function (h) {
      return { x: h.x * size.w, y: h.y * size.h };
    });
  }

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function render() {
    var size = boardSize();
    var holes = screenHoles();
    var points = R.pointsFor(holes, pegAt);
    var bad = R.tangled(holes, pegAt, puzzle.edges);

    svgEl.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
    svgEl.setAttribute('width', size.w);
    svgEl.setAttribute('height', size.h);
    svgEl.textContent = '';

    // Strings first, so pegs sit on top of them.
    puzzle.edges.forEach(function (edge, index) {
      var a = points[edge[0]], b = points[edge[1]];
      svgEl.appendChild(el('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        class: 'string ' + (bad[index] ? 'tangled' : 'clear')
      }));
    });

    // Empty holes, so it is obvious where a peg may go.
    holes.forEach(function (hole, index) {
      if (pegAt[index] !== null) return;
      svgEl.appendChild(el('circle', {
        cx: hole.x, cy: hole.y, r: PEG_R * 0.55, class: 'hole'
      }));
    });

    holes.forEach(function (hole, index) {
      var group = el('g', {
        class: 'peg-group' + (selected === index ? ' selected' : ''),
        tabindex: '0',
        role: 'button',
        'aria-label': pegAt[index] === null
          ? 'Empty hole'
          : 'Peg ' + (pegAt[index] + 1)
      });

      if (pegAt[index] !== null) {
        group.appendChild(el('circle', {
          cx: hole.x, cy: hole.y, r: PEG_R, class: 'peg'
        }));
      }
      // Always present, always the same size: the tap target does not shrink
      // just because a hole happens to be empty.
      group.appendChild(el('circle', {
        cx: hole.x, cy: hole.y, r: HIT_R, class: 'peg-hit'
      }));

      group.addEventListener('click', function () { onTap(index); });
      svgEl.appendChild(group);
    });

    paintLevel();
  }

  function paintLevel() {
    var level = Portal.state.progress(GAME) + 1;
    document.getElementById('level').textContent =
      'Level ' + level + '  ·  ' + (puzzle.name || 'Easy');
  }

  function paintSelection() {
    var groups = svgEl.querySelectorAll('.peg-group');
    for (var i = 0; i < groups.length; i++) {
      groups[i].classList.toggle('selected', i === selected);
    }
  }

  // --------------------------------------------------------------- playing

  function onTap(index) {
    if (selected === null) {
      if (pegAt[index] !== null) {           // an empty hole holds nothing to lift
        selected = index;
        paintSelection();
      }
      return;
    }

    if (selected === index) {                // tapping it again puts it back
      selected = null;
      paintSelection();
      return;
    }

    move(selected, index);
  }

  function move(from, to) {
    pegAt = R.swap(pegAt, from, to);
    moves.push({ a: from, b: to });
    selected = null;
    save();
    render();

    if (R.isSolved(screenHoles(), pegAt, puzzle.edges)) win();
  }

  function win() {
    Portal.state.progress(GAME, Portal.state.progress(GAME) + 1);
    Portal.celebrate.show({
      message: 'You did it!',
      again: function () {
        newPuzzle();
        render();
      }
    });
  }

  // -------------------------------------------------------------- controls

  function undo() {
    if (!moves.length) return;
    moves.pop();
    pegAt = R.replay(puzzle.start, moves);
    selected = null;
    save();
    render();
  }

  function startOver() {
    moves = [];
    pegAt = puzzle.start.slice();
    selected = null;
    save();
    render();
  }

  function init() {
    Portal.shell.start({ game: GAME });
    stageEl = document.getElementById('stage');
    svgEl = document.getElementById('board');

    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('restart').addEventListener('click', startOver);

    if (!restore()) newPuzzle();
    render();

    // The board is laid out in fractions of the stage, so a rotated phone or a
    // browser bar sliding away just redraws at the new size.
    window.addEventListener('resize', function () { render(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  Portal.untangle.game = {
    _state: function () {
      return {
        puzzle: puzzle,
        moves: moves.map(function (m) { return { a: m.a, b: m.b }; }),
        pegAt: pegAt.slice(),
        selected: selected
      };
    },
    _tap: onTap,
    _undo: undo,
    _startOver: startOver,
    _screenHoles: screenHoles
  };
})(window.Portal = window.Portal || {});
