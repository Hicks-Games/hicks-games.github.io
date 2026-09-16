/* Crash guard.
 *
 * If something in this portal throws an error we didn't anticipate, a plain
 * web page just stops — frozen, no message, no way out. For a player with
 * Alzheimer's, a frozen game doesn't read as "the app broke". It reads as
 * "I did something wrong".
 *
 * So: any uncaught error puts a large, calm screen in front of him with one
 * button back to the games, and writes what happened to a journal on the
 * phone that Travis can read later. Nothing is transmitted anywhere.
 *
 * The recovery screen is built with inline styles on purpose. It may have to
 * render on a page whose stylesheet is exactly what failed.
 */
(function (Portal) {
  'use strict';

  var JOURNAL_KEY = 'portal.errors';
  var JOURNAL_MAX = 20;
  var REPEAT_WINDOW_MS = 60 * 1000;
  var REPEAT_LIMIT = 2;

  var installed = false;
  var shown = false;
  var currentGame = 'portal';

  function readJournal() {
    try {
      return JSON.parse(window.localStorage.getItem(JOURNAL_KEY)) || [];
    } catch (err) {
      return [];
    }
  }

  function writeJournal(entries) {
    try {
      window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage is gone or full. The recovery screen still matters more than
      // the journal, so this failing changes nothing the player sees.
    }
  }

  function record(info) {
    var entries = readJournal();
    entries.push(info);
    // Ring buffer: the newest errors are the ones worth keeping.
    if (entries.length > JOURNAL_MAX) {
      entries = entries.slice(entries.length - JOURNAL_MAX);
    }
    writeJournal(entries);
    return entries;
  }

  /* Has this same game just crashed repeatedly? If so, sending him back into
   * it would loop him straight into the same wall, so recovery goes home
   * instead. */
  function isRepeating(entries, game) {
    var now = Date.now();
    var recent = 0;
    for (var i = entries.length - 1; i >= 0; i--) {
      var e = entries[i];
      if (now - (e.at || 0) > REPEAT_WINDOW_MS) break;
      if (e.game === game) recent++;
    }
    return recent > REPEAT_LIMIT;
  }

  function homeHref() {
    // Works from the root page and from any game folder underneath it.
    return /\/(water-sort|untangle|sudoku|words|test)\//.test(location.pathname)
      ? '../'
      : './';
  }

  function showRecovery(goHome) {
    if (shown) return; // One screen. A cascade of errors is still one crash.
    shown = true;

    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'alertdialog');
    wrap.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:#f4f1ea', 'color:#22303c',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'text-align:center', 'padding:24px', 'box-sizing:border-box',
      'font:500 22px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      '-webkit-user-select:none', 'user-select:none'
    ].join(';');

    var msg = document.createElement('p');
    msg.textContent = goHome
      ? "Let's try a different game."
      : "Let's go back to the games.";
    msg.style.cssText = 'font-size:28px;margin:0 0 36px;max-width:16em;';

    var btn = document.createElement('button');
    btn.textContent = goHome ? 'All Games' : 'Back to Games';
    btn.style.cssText = [
      'font:600 26px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      'min-height:84px', 'min-width:240px', 'padding:0 32px',
      'border:none', 'border-radius:16px',
      'background:#1b3a5c', 'color:#ffffff',
      'cursor:pointer', 'touch-action:manipulation'
    ].join(';');

    btn.addEventListener('click', function () {
      window.location.href = homeHref();
    });

    wrap.appendChild(msg);
    wrap.appendChild(btn);

    // If the crash happened before <body> existed, there is nothing to attach
    // to yet — wait for it rather than throwing inside the error handler.
    if (document.body) {
      document.body.appendChild(wrap);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(wrap);
      });
    }
  }

  function handle(kind, message, source, line, col, stack) {
    var entries = record({
      at: Date.now(),
      when: new Date().toISOString(),
      game: currentGame,
      kind: kind,
      message: String(message || 'unknown'),
      where: String(source || location.pathname) + ':' + (line || 0) + ':' + (col || 0),
      stack: stack ? String(stack).slice(0, 800) : ''
    });
    showRecovery(isRepeating(entries, currentGame));
  }

  Portal.guard = {
    /* Called once per page by shell.js, before anything else runs. */
    install: function (game) {
      currentGame = game || 'portal';
      if (installed) return;
      installed = true;

      window.addEventListener('error', function (event) {
        handle(
          'error',
          event.message,
          event.filename,
          event.lineno,
          event.colno,
          event.error && event.error.stack
        );
      });

      window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason || {};
        handle(
          'promise',
          reason.message || reason,
          null, 0, 0,
          reason.stack
        );
      });
    },

    /* Read by the settings hatch so Travis can see what went wrong without
     * plugging the phone into anything. */
    journal: readJournal,

    /* Only ever called deliberately from the settings hatch, after the
     * errors have been read. */
    clearJournal: function () {
      writeJournal([]);
    },

    /* Test seams. The full path (journal + recovery screen) is exercised by
     * loading a page that genuinely throws, in an iframe — see test.html.
     * _record is the journal half on its own, so tests of the journal don't
     * paint a recovery screen over the test results. */
    _record: record,
    _handle: handle
  };
})(window.Portal = window.Portal || {});
