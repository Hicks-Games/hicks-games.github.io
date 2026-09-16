/* Saved games.
 *
 * Every game saves the same shape: the puzzle it started from, plus the list
 * of moves made since. The board you see, the undo history, and "start over"
 * are all derived by replaying that list — so there is no second structure
 * that can drift out of sync with the board and quietly corrupt a game.
 *
 *   { v: 1, puzzle: <whatever the game's generator produced>, moves: [ ... ] }
 *
 * Rules this file exists to enforce:
 *   - Keys are always namespaced `portal.*`. Never clear storage wholesale.
 *   - Storage failing is never allowed to break the game. If the browser
 *     refuses to store anything, play continues and saving silently stops.
 *   - A save we don't understand is left alone, never deleted. Losing an
 *     in-progress game is worse than starting a fresh one.
 */
(function (Portal) {
  'use strict';

  var SCHEMA = 1;
  var PREFIX = 'portal.';

  // Chrome can throw on the very first touch of localStorage (private mode,
  // blocked site data, enterprise policy). Find out once, here, rather than
  // letting it throw mid-move later.
  var storage = (function () {
    try {
      var probe = PREFIX + 'probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      return null;
    }
  })();

  function key(game) {
    return PREFIX + game + '.save';
  }

  /* Migrations from older save formats. Each entry takes a record at version
   * N and returns one at N+1. There are none yet — version 1 is the first
   * format — but the path exists so that the day the format changes, the
   * answer is "write a migration", not "ship something that eats his game". */
  var migrations = {
    // 1: function (rec) { ...; return rec; }
  };

  function migrate(rec) {
    while (rec.v < SCHEMA) {
      var step = migrations[rec.v];
      if (!step) return null; // No path forward. Leave the record alone.
      rec = step(rec);
      rec.v += 1;
    }
    return rec;
  }

  var state = {
    /* True when saves are actually being written. The games don't need to
     * care — they call save() either way — but the test page checks it. */
    get available() {
      return storage !== null;
    },

    /* Ask the browser to treat this data as worth keeping when the phone is
     * low on space. Best effort: no browser is obliged to agree, and nothing
     * here depends on the answer. */
    requestPersistence: function () {
      try {
        if (navigator.storage && navigator.storage.persist) {
          return navigator.storage.persist().catch(function () { return false; });
        }
      } catch (err) { /* not supported; carry on */ }
      return Promise.resolve(false);
    },

    /* Returns {puzzle, moves} to resume, or null to start a fresh puzzle.
     * Null is always a valid answer — a corrupt, foreign, or missing save all
     * mean the same thing to the player: here is a new puzzle. */
    load: function (game) {
      if (!storage) return null;
      var raw;
      try {
        raw = storage.getItem(key(game));
      } catch (err) {
        return null;
      }
      if (!raw) return null;

      var rec;
      try {
        rec = JSON.parse(raw);
      } catch (err) {
        // Corrupted JSON. Don't delete it — a future version might rescue it,
        // and a fresh puzzle costs him nothing.
        return null;
      }

      if (!rec || typeof rec !== 'object') return null;
      if (typeof rec.v !== 'number' || !rec.puzzle) return null;
      if (rec.v > SCHEMA) return null; // Written by a newer version. Leave it.
      if (rec.v < SCHEMA) {
        rec = migrate(rec);
        if (!rec) return null;
      }
      if (!Array.isArray(rec.moves)) return null;

      return { puzzle: rec.puzzle, moves: rec.moves };
    },

    /* Called after every single move. Cheap by design: these records are a
     * few hundred bytes, so there is no reason to debounce and risk losing
     * the last move to a phone that goes to sleep. */
    save: function (game, puzzle, moves) {
      if (!storage) return false;
      try {
        storage.setItem(key(game), JSON.stringify({
          v: SCHEMA,
          puzzle: puzzle,
          moves: moves || []
        }));
        return true;
      } catch (err) {
        // Quota exceeded or storage revoked mid-session. The game keeps
        // playing; it just stops being resumable.
        return false;
      }
    },

    /* Forget one game's saved position. Only ever called for a single game,
     * and only when that game is genuinely finished. */
    clear: function (game) {
      if (!storage) return;
      try {
        storage.removeItem(key(game));
      } catch (err) { /* nothing to do */ }
    },

    /* Read/write the small settings object Travis controls. Kept here so
     * every namespaced key lives in one file. */
    settings: function (next) {
      if (!storage) return {};
      var k = PREFIX + 'settings';
      if (next === undefined) {
        try {
          return JSON.parse(storage.getItem(k)) || {};
        } catch (err) {
          return {};
        }
      }
      try {
        storage.setItem(k, JSON.stringify(next));
      } catch (err) { /* settings are not worth breaking anything over */ }
      return next;
    },

    SCHEMA: SCHEMA,
    PREFIX: PREFIX
  };

  Portal.state = state;
})(window.Portal = window.Portal || {});
