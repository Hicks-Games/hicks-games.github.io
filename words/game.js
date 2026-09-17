/* Word game — the screen.
 *
 * Tap letters to spell a word, then tap Enter. Undo takes the last letter
 * back, which is what "undo the last thing I did" means in this game, so the
 * three controls keep the same meaning they have everywhere else.
 *
 * Every word to find has a slot, showing a dash per letter until it is found.
 * That is not decoration: it tells him a four-letter word is waiting, which is
 * the difference between looking and guessing. He needs about two in five for
 * the celebration — hunting the last obscure one turns a restful game into
 * homework — and he can keep going afterwards if he wants to.
 */
(function (Portal) {
  'use strict';

  var R = Portal.words.rules;
  var G = Portal.words.generator;
  var GAME = 'words';

  var puzzle = null;
  var moves = [];        // the words he has found, in order
  var found = [];        // derived from moves
  var spelling = [];     // tile indexes he has tapped, in order
  var celebrated = false;

  var slotsEl, currentEl, tilesEl, enterEl;

  function settings() { return Portal.state.settings(); }

  function difficulty() {
    return settings().wordsDifficulty || 'easy';
  }

  function save() {
    Portal.state.save(GAME, puzzle, moves);
  }

  function newPuzzle() {
    puzzle = G.generate({ difficulty: difficulty() });
    moves = [];
    found = [];
    spelling = [];
    celebrated = false;
    save();
  }

  function restore() {
    var saved = Portal.state.load(GAME);
    if (!saved || !saved.puzzle || !saved.puzzle.letters) return false;

    var rebuilt = R.replay(saved.puzzle.findable, saved.moves);
    if (!rebuilt) return false;
    if (rebuilt.length >= saved.puzzle.findable.length) return false;  // nothing left

    puzzle = saved.puzzle;
    moves = saved.moves;
    found = rebuilt;
    spelling = [];
    // He has already been congratulated for this one; don't do it again on
    // reopening, but let him carry on finding words.
    celebrated = R.isSolved(found, puzzle.findable.length);
    return true;
  }

  function currentWord() {
    return spelling.map(function (i) { return puzzle.letters[i]; }).join('');
  }

  // ------------------------------------------------------------- rendering

  function render() {
    renderSlots();
    renderTiles();
    renderCurrent();
    paintLevel();
  }

  /* A slot per word to find: dashes until found, the word once it is. */
  function renderSlots() {
    slotsEl.textContent = '';
    puzzle.findable.forEach(function (word) {
      var slot = document.createElement('div');
      var got = found.indexOf(word) !== -1;
      slot.className = 'slot' + (got ? ' found' : '');
      slot.textContent = got ? word : new Array(word.length + 1).join('–');
      slotsEl.appendChild(slot);
    });
  }

  function renderTiles() {
    // Two rows, so seven tiles stay wide enough to hit.
    tilesEl.style.setProperty('--tile-cols', Math.ceil(puzzle.letters.length / 2));
    tilesEl.textContent = '';

    puzzle.letters.forEach(function (letter, index) {
      var tile = document.createElement('button');
      var inUse = spelling.indexOf(index) !== -1;
      tile.className = 'tile' + (inUse ? ' in-use' : '');
      tile.type = 'button';
      tile.textContent = letter.toUpperCase();
      tile.setAttribute('aria-label',
        letter.toUpperCase() + (inUse ? ', already used' : ''));
      tile.addEventListener('click', function () { onTile(index); });
      tilesEl.appendChild(tile);
    });
  }

  function renderCurrent() {
    var word = currentWord();
    currentEl.textContent = word.toUpperCase();
    // Enter stays put and stays tappable whatever is spelled; a word that
    // isn't one is answered by the board, not by a disabled button.
    enterEl.classList.toggle('ready', isNewWord(word));
  }

  function paintLevel() {
    var level = Portal.state.progress(GAME) + 1;
    document.getElementById('level').textContent =
      'Level ' + level + '  ·  ' + found.length + ' of ' + puzzle.findable.length;
  }

  function isNewWord(word) {
    return word.length >= Portal.words.list.MIN_LEN &&
           puzzle.findable.indexOf(word) !== -1 &&
           found.indexOf(word) === -1;
  }

  // --------------------------------------------------------------- playing

  function onTile(index) {
    if (spelling.indexOf(index) !== -1) return;   // that tile is already in use
    spelling.push(index);
    renderTiles();
    renderCurrent();
  }

  function onEnter() {
    var word = currentWord();
    if (!word) return;

    if (!isNewWord(word)) {
      /* Not a word, or one he already has. The board says so by flinching —
       * no message to read, nothing to dismiss, and it clears itself. The same
       * idea as a tangled string showing red: the state, not a telling-off. */
      currentEl.classList.remove('rejected');
      // Reading offsetWidth forces the browser to apply the removal before
      // the class goes back on, so the animation restarts every time.
      void currentEl.offsetWidth;
      currentEl.classList.add('rejected');
      spelling = [];
      renderTiles();
      setTimeout(function () {
        currentEl.classList.remove('rejected');
        renderCurrent();
      }, 420);
      return;
    }

    found.push(word);
    moves.push({ word: word });
    spelling = [];
    save();
    render();
    Portal.celebrate.blip();

    // Let the new word land before the celebration covers the board.
    var slot = slotsEl.querySelector('.slot.found:last-of-type');
    if (slot) slot.classList.add('just-found');

    if (!celebrated && R.isSolved(found, puzzle.findable.length)) {
      celebrated = true;
      Portal.state.progress(GAME, Portal.state.progress(GAME) + 1);
      setTimeout(function () { win(false); }, 400);
    } else if (found.length === puzzle.findable.length) {
      setTimeout(function () { win(true); }, 400);
    }
  }

  function win(everyOne) {
    Portal.celebrate.show({
      message: everyOne ? 'Every single one!' : 'You did it!',
      againLabel: 'New Letters',
      again: function () {
        newPuzzle();
        render();
      },
      keepGoing: everyOne ? null : function () { render(); }
    });
  }

  // -------------------------------------------------------------- controls

  function undo() {
    if (spelling.length) {            // take the last letter back
      spelling.pop();
      renderTiles();
      renderCurrent();
      return;
    }
    if (!moves.length) return;        // nothing at all to undo: say nothing
    moves.pop();
    found = R.replay(puzzle.findable, moves);
    save();
    render();
  }

  function startOver() {
    moves = [];
    found = [];
    spelling = [];
    celebrated = false;
    save();
    render();
  }

  function init() {
    Portal.shell.start({ game: GAME });
    slotsEl = document.getElementById('slots');
    currentEl = document.getElementById('current');
    tilesEl = document.getElementById('tiles');
    enterEl = document.getElementById('enter');

    enterEl.addEventListener('click', onEnter);
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

  Portal.words.game = {
    _state: function () {
      return {
        puzzle: puzzle,
        moves: moves.map(function (m) { return { word: m.word }; }),
        found: found.slice(),
        spelling: spelling.slice(),
        current: currentWord()
      };
    },
    _tapTile: onTile,
    _enter: onEnter,
    _undo: undo,
    _startOver: startOver,
    /* Spell a word by tapping its letters, the way he would. Returns false if
     * the tiles cannot spell it at all. */
    _spell: function (word) {
      spelling = [];
      for (var i = 0; i < word.length; i++) {
        var at = -1;
        for (var t = 0; t < puzzle.letters.length; t++) {
          if (puzzle.letters[t] === word[i] && spelling.indexOf(t) === -1) {
            at = t;
            break;
          }
        }
        if (at === -1) { spelling = []; return false; }
        spelling.push(at);
      }
      renderTiles();
      renderCurrent();
      return true;
    }
  };
})(window.Portal = window.Portal || {});
