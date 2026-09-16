/* Water sort — the screen.
 *
 * Tap a vial to pick it up, tap another to pour. No dragging anywhere: a drag
 * is a gesture that can go wrong halfway, and a tap is not.
 *
 * The board is never stored directly. What is stored is the puzzle it started
 * from and the list of pours since, and the board is rebuilt from those. Undo
 * drops the last pour, Start Over drops them all, and reopening the app a week
 * later replays them. One source of truth, so the board on screen and the
 * history behind it can never disagree.
 */
(function (Portal) {
  'use strict';

  var R = Portal.watersort.rules;
  var G = Portal.watersort.generator;
  var GAME = 'water-sort';

  /* Optional shapes stamped on each colour, for eyes that have stopped
   * trusting colour alone. Off unless switched on in settings. */
  var SYMBOLS = ['●', '▲', '■', '◆',
                 '★', '✚', '⬟', '✖'];

  var puzzle = null;   // the dealt board, its verified solution, its settings
  var moves = [];      // every pour he has made, in order
  var board = null;    // derived: replay(puzzle.board, moves)
  var selected = null; // index of the vial he is holding, or null

  var boardEl;

  function settings() {
    return Portal.state.settings();
  }

  function difficulty() {
    return settings().watersortDifficulty || 'easy';
  }

  function save() {
    Portal.state.save(GAME, puzzle, moves);
  }

  function newPuzzle() {
    puzzle = G.generate({ difficulty: difficulty() });
    moves = [];
    board = R.clone(puzzle.board);
    selected = null;
    save();
  }

  /* Pick up where he left off, whether that was a minute or a month ago. */
  function restore() {
    var saved = Portal.state.load(GAME);
    if (!saved || !saved.puzzle || !saved.puzzle.board) return false;

    var capacity = saved.puzzle.capacity || R.CAPACITY;
    var rebuilt = R.replay(saved.puzzle.board, saved.moves, capacity);
    if (!rebuilt) return false;                      // save doesn't fit its puzzle

    // He finished this one before he put the phone down. Finishing it again
    // isn't a reward, so deal him a new puzzle instead.
    if (R.isSolved(rebuilt, capacity)) return false;

    puzzle = saved.puzzle;
    moves = saved.moves;
    board = rebuilt;
    selected = null;
    return true;
  }

  // ------------------------------------------------------------- rendering

  /* Never more than four across. Five columns on a 360px screen leaves each
   * vial about 60px wide, under the 64px every tappable thing in this portal
   * has to clear — a ten-vial puzzle would quietly become the one game his
   * thumb can't hit. More rows instead; there is height to spare. */
  function columnsFor(count) {
    return count <= 6 ? 3 : 4;
  }

  /* In a mystery puzzle, work out which liquid he has actually seen. Derived
   * from the move list, so it is right after closing the app for a month. */
  function seenUnits() {
    if (!puzzle.hidden) return null;
    return R.replayRevealing(puzzle.board, moves, puzzle.capacity || R.CAPACITY);
  }

  /* arriving: {to, count} marks the liquid that just landed, so it can rise
   * into place instead of appearing from nowhere. */
  function render(arriving) {
    var showSymbols = settings().symbols === true;
    var tracked = seenUnits();
    boardEl.style.setProperty('--cols', columnsFor(board.length));
    boardEl.textContent = '';

    board.forEach(function (vial, index) {
      var tap = document.createElement('button');
      tap.className = 'vial-tap' + (selected === index ? ' selected' : '');
      tap.type = 'button';
      tap.setAttribute('aria-label', describe(vial, index, tracked));

      var glass = document.createElement('div');
      glass.className = 'vial';

      vial.forEach(function (colour, depth) {
        var layer = document.createElement('div');
        layer.className = 'layer';

        var known = !tracked || tracked.seen[tracked.ids[index][depth]];
        if (known) {
          layer.style.background = 'var(--c' + colour + ')';
          if (showSymbols) layer.textContent = SYMBOLS[colour % SYMBOLS.length];
        } else {
          layer.className += ' hidden-layer';
          layer.textContent = '?';
        }

        if (arriving && arriving.to === index &&
            depth >= vial.length - arriving.count) {
          layer.classList.add('arriving');
        }
        glass.appendChild(layer);   // column-reverse puts index 0 at the bottom
      });

      tap.appendChild(glass);
      tap.addEventListener('click', function () { onTap(index); });
      boardEl.appendChild(tap);
    });

    paintLevel();
  }

  /* Where he is, rather than a promise about the puzzle. The guarantee that
   * every puzzle can be finished hasn't gone anywhere — it is enforced by the
   * generator and proved by the test page — it just no longer needs saying on
   * screen every second of every game. */
  function paintLevel() {
    var level = Portal.state.progress(GAME) + 1;
    document.getElementById('level').textContent =
      'Level ' + level + '  ·  ' + (puzzle.name || 'Easy');
  }

  function describe(vial, index, tracked) {
    if (!vial.length) return 'Empty vial ' + (index + 1);
    var label = 'Vial ' + (index + 1) + ', ' + vial.length +
                (vial.length === 1 ? ' layer' : ' layers');
    if (tracked) label += ', some hidden';
    return label;
  }

  /* Selection changes only toggle a class, never a re-render, so the vial
   * actually animates as it lifts. */
  function paintSelection() {
    var taps = boardEl.querySelectorAll('.vial-tap');
    for (var i = 0; i < taps.length; i++) {
      taps[i].classList.toggle('selected', i === selected);
    }
  }

  function select(index) {
    selected = index;
    paintSelection();
  }

  // --------------------------------------------------------------- playing

  function onTap(index) {
    var capacity = puzzle.capacity || R.CAPACITY;

    if (selected === null) {
      if (board[index].length) select(index);
      return;
    }

    if (selected === index) {           // tapping it again puts it back down
      select(null);
      return;
    }

    if (R.canPour(board, selected, index, capacity)) {
      pour(selected, index, capacity);
      return;
    }

    /* The pour isn't legal. Rather than refusing — which would need a message
     * explaining why, and messages are the thing this portal doesn't do — the
     * tap is simply taken to mean "I meant this vial instead". */
    select(board[index].length ? index : null);
  }

  function pour(from, to, capacity) {
    var count = R.pourAmount(board, from, to, capacity);
    var next = R.pour(board, from, to, capacity);
    if (!next) return;

    board = next;
    moves.push({ from: from, to: to });
    selected = null;
    save();
    render({ to: to, count: count });

    if (R.isSolved(board, capacity)) win();
  }

  function win() {
    var finished = Portal.state.progress(GAME) + 1;
    Portal.state.progress(GAME, finished);
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
    if (!moves.length) return;          // silently does nothing; never scolds
    moves.pop();
    board = R.replay(puzzle.board, moves, puzzle.capacity || R.CAPACITY);
    selected = null;
    save();
    render();
  }

  function startOver() {
    moves = [];
    board = R.clone(puzzle.board);
    selected = null;
    save();
    render();
  }

  function init() {
    Portal.shell.start({ game: GAME });
    boardEl = document.getElementById('board');

    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('restart').addEventListener('click', startOver);

    if (!restore()) newPuzzle();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed so the test page can drive a real game without a real thumb.
  Portal.watersort.game = {
    /* A snapshot, not the live objects. Handing out the real arrays lets a
     * test compare a "before" against an "after" that silently changed
     * underneath it, which is a very convincing way to get a green tick for
     * something that never happened. */
    _state: function () {
      return {
        puzzle: puzzle,
        moves: moves.map(function (m) { return { from: m.from, to: m.to }; }),
        board: R.clone(board),
        selected: selected
      };
    },
    _tap: onTap,
    _undo: undo,
    _startOver: startOver
  };
})(window.Portal = window.Portal || {});
