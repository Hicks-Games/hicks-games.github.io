/* Sudoku — the screen.
 *
 * Tap a square, tap a number. Tapping the number that is already there takes
 * it out again. The puzzle's own numbers cannot be changed, so tapping one
 * does nothing at all — the same as tapping an empty hole in untangle.
 *
 * Nothing corrects him as he goes. Numbers stay exactly where he puts them,
 * and the board says nothing until the grid is full. At that point, if
 * something clashes, the clashing numbers turn red — not as a telling-off,
 * but because a finished grid that simply refuses to celebrate would leave
 * him with no way to find out why.
 */
(function (Portal) {
  'use strict';

  var R = Portal.sudoku.rules;
  var G = Portal.sudoku.generator;
  var GAME = 'sudoku';

  var puzzle = null;
  var moves = [];
  var grid = null;      // derived: replay(puzzle.givens, moves)
  var selected = null;  // index of the square he has tapped, or null

  var gridEl, padEl;

  function settings() { return Portal.state.settings(); }

  function difficulty() {
    return settings().sudokuDifficulty || 'classic';
  }

  function save() {
    Portal.state.save(GAME, puzzle, moves);
  }

  function newPuzzle() {
    puzzle = G.generate({ difficulty: difficulty() });
    moves = [];
    grid = puzzle.givens.slice();
    selected = null;
    save();
  }

  function restore() {
    var saved = Portal.state.load(GAME);
    if (!saved || !saved.puzzle || !saved.puzzle.givens) return false;

    var rebuilt = R.replay(saved.puzzle.givens, saved.moves);
    if (!rebuilt) return false;
    if (R.isSolved(rebuilt, saved.puzzle.solution)) return false;  // already done

    puzzle = saved.puzzle;
    moves = saved.moves;
    grid = rebuilt;
    selected = null;
    return true;
  }

  // ------------------------------------------------------------- rendering

  /* Clashing numbers are shown once the grid is full, so a finished grid can
   * explain itself. Travis can turn them on for the whole game if it turns
   * out to suit him better. */
  function showingConflicts() {
    return settings().sudokuShowConflicts === true || R.isComplete(grid);
  }

  function render() {
    var n = puzzle.n;
    var bad = showingConflicts() ? R.conflicts(grid, n, puzzle.boxW, puzzle.boxH) : {};

    gridEl.style.setProperty('--n', n);
    gridEl.style.setProperty('--box-w', puzzle.boxW);
    gridEl.style.setProperty('--box-h', puzzle.boxH);
    gridEl.textContent = '';

    for (var i = 0; i < n * n; i++) {
      var cell = document.createElement('button');
      var given = !!puzzle.givens[i];
      var classes = ['cell'];
      if (given) classes.push('given');
      if (selected === i) classes.push('selected');
      if (bad[i]) classes.push('clash');
      // Heavier rules where the boxes meet, so the shape of the grid reads at
      // a glance rather than having to be counted out.
      if ((i % n) % puzzle.boxW === 0 && (i % n) !== 0) classes.push('box-left');
      if (Math.floor(i / n) % puzzle.boxH === 0 && i >= n) classes.push('box-top');

      cell.className = classes.join(' ');
      cell.type = 'button';
      cell.textContent = grid[i] ? String(grid[i]) : '';
      cell.setAttribute('aria-label',
        (grid[i] ? 'Square holding ' + grid[i] : 'Empty square') +
        (given ? ', part of the puzzle' : ''));

      (function (index) {
        cell.addEventListener('click', function () { onCell(index); });
      })(i);

      gridEl.appendChild(cell);
    }

    renderPad();
    paintLevel();
  }

  function renderPad() {
    var n = puzzle.n;
    padEl.style.setProperty('--pad-cols', n <= 4 ? 2 : 3);
    padEl.textContent = '';

    for (var v = 1; v <= n; v++) {
      var key = document.createElement('button');
      key.className = 'btn pad-key';
      key.type = 'button';
      key.textContent = String(v);
      (function (value) {
        key.addEventListener('click', function () { onNumber(value); });
      })(v);
      padEl.appendChild(key);
    }
  }

  function paintLevel() {
    var level = Portal.state.progress(GAME) + 1;
    document.getElementById('level').textContent =
      'Level ' + level + '  ·  ' + (puzzle.name || 'Classic');
  }

  function paintSelection() {
    var cells = gridEl.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('selected', i === selected);
    }
  }

  // --------------------------------------------------------------- playing

  function onCell(index) {
    // The puzzle's own numbers are not his to change, so tapping one does
    // nothing rather than selecting a square whose numbers won't take.
    if (puzzle.givens[index]) return;
    selected = (selected === index) ? null : index;
    paintSelection();
  }

  function onNumber(value) {
    if (selected === null) return;          // nothing to write in
    // Tapping the number already there rubs it out.
    var next = grid[selected] === value ? 0 : value;
    if (next === grid[selected]) return;

    grid[selected] = next;
    moves.push({ cell: selected, value: next });
    save();

    var wasComplete = R.isComplete(grid);
    render();

    if (wasComplete && R.matchesSolution(grid, puzzle.solution)) win();
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
    grid = R.replay(puzzle.givens, moves);
    selected = null;
    save();
    render();
  }

  function startOver() {
    moves = [];
    grid = puzzle.givens.slice();
    selected = null;
    save();
    render();
  }

  function init() {
    Portal.shell.start({ game: GAME });
    gridEl = document.getElementById('grid');
    padEl = document.getElementById('pad');

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

  Portal.sudoku.game = {
    _state: function () {
      return {
        puzzle: puzzle,
        moves: moves.map(function (m) { return { cell: m.cell, value: m.value }; }),
        grid: grid.slice(),
        selected: selected
      };
    },
    _tapCell: onCell,
    _tapNumber: onNumber,
    _undo: undo,
    _startOver: startOver
  };
})(window.Portal = window.Portal || {});
