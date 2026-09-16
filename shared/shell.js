/* Page bootstrap.
 *
 * Every page in the portal starts the same way:
 *
 *   Portal.shell.start({ game: 'water-sort' });
 *
 * That one call installs the crash guard, the gesture guards, the back
 * handling, and the Home button. It lives in one file so that a fix to any
 * of that lands on every page at once — a copy-pasted safety net is a safety
 * net with a hole in whichever copy got missed.
 */
(function (Portal) {
  'use strict';

  /* Ways an accidental touch can turn the game into something he doesn't
   * recognise. Each of these is a real thing a resting palm or a shaky tap
   * can trigger on Android Chrome. */
  function installGestureGuards() {
    // Android's copy/share popup on long-press. An interruption we don't own
    // and can't style, so it must never appear.
    document.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    // Text selection handles ("drag to select") appearing over a puzzle.
    document.addEventListener('selectstart', function (event) {
      event.preventDefault();
    });

    // Double-tap-to-zoom. touch-action in CSS covers most of it; this catches
    // the rest without blocking ordinary taps.
    var lastTouch = 0;
    document.addEventListener('touchend', function (event) {
      var now = Date.now();
      if (now - lastTouch < 350) event.preventDefault();
      lastTouch = now;
    }, { passive: false });

    // Pinch zoom. Chrome's "force enable zoom" accessibility setting overrides
    // the viewport tag, so the layout must survive zoom regardless — but there
    // is no reason to invite it here.
    document.addEventListener('gesturestart', function (event) {
      event.preventDefault();
    });
  }

  /* Keep the Android back gesture inside the portal.
   *
   * On a game page this is unnecessary: the pages are real pages, so back
   * already means "return to the menu", which is exactly what we want.
   *
   * On the menu there is nothing behind us but the outside world, so we leave
   * a spare history entry for back to consume and put it straight back.
   *
   * Caveat, and the reason this is isolated and cheap: Chrome ships a history
   * manipulation intervention aimed at pages that do precisely this (it is an
   * ad-page trick), and it may ignore entries pushed without a user gesture.
   * If it does, nothing breaks — an accidental exit costs one tap on the icon
   * and no progress, because the game was saved on his last move. This is
   * belt, not braces. It gets verified on the real phone before v1.
   */
  function installBackTrap() {
    try {
      history.pushState({ portal: 'root' }, '');
      window.addEventListener('popstate', function () {
        history.pushState({ portal: 'root' }, '');
      });
    } catch (err) {
      // Some privacy modes throttle history calls. Not worth a crash.
    }
  }

  function wireHomeButtons() {
    var nodes = document.querySelectorAll('[data-portal-home]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', function () {
        window.location.href = '../';
      });
    }
  }

  Portal.shell = {
    /* opts.game  — short id used for save keys and crash journal entries.
     * opts.isMenu — true on the portal's front page. */
    start: function (opts) {
      opts = opts || {};
      var game = opts.game || 'portal';

      // First, so that a crash anywhere below still lands on a calm screen.
      Portal.guard.install(game);

      installGestureGuards();
      if (opts.isMenu) installBackTrap();

      Portal.state.requestPersistence();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireHomeButtons);
      } else {
        wireHomeButtons();
      }

      /* The service worker is registered here — deliberately not yet.
       *
       * A cache-first service worker during development serves yesterday's
       * files and makes every edit look like it did nothing. It is the last
       * thing built (task T8), once the games are stable, and nothing else
       * depends on it. Offline support is the only thing missing until then.
       */
    },

    version: '0.1.0-dev'
  };
})(window.Portal = window.Portal || {});
