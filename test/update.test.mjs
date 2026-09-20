/* The update path in ui.js reloads the page by itself, so the guards around it
   matter more than the feature: reloading on a first install, or twice, or
   while someone is mid-entry, would each be worse than never updating at all.

   This mirrors the state machine from the bottom of js/ui.js.

   Run: node test/update.test.mjs */

function makeApp({ hadController }) {
  const state = { reloads: 0, sheetOpen: false, updateReady: false, reloading: false };

  const applyUpdateIfIdle = () => {
    if (!state.updateReady || state.reloading) return;
    if (state.sheetOpen) return;
    state.reloading = true;
    state.reloads++;
  };

  return {
    state,
    controllerChanged() {
      if (!hadController) return;
      state.updateReady = true;
      applyUpdateIfIdle();
    },
    sheetClosed() { state.sheetOpen = false; applyUpdateIfIdle(); },
    foregrounded() { applyUpdateIfIdle(); },
    openSheet() { state.sheetOpen = true; },
  };
}

let bad = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${got}, want ${want})`}`);
};

// A first install claims control, but there is no older page to replace.
const fresh = makeApp({ hadController: false });
fresh.controllerChanged();
fresh.foregrounded();
check('first install never reloads', fresh.state.reloads, 0);

// The ordinary case: a new worker takes over while nothing is going on.
const idle = makeApp({ hadController: true });
idle.controllerChanged();
check('an update reloads once', idle.state.reloads, 1);

// And cannot be made to do it twice.
idle.controllerChanged();
idle.foregrounded();
idle.sheetClosed();
check('and only once, however often it is poked', idle.state.reloads, 1);

// Mid-entry, the page must stay put.
const busy = makeApp({ hadController: true });
busy.openSheet();
busy.controllerChanged();
check('an open sheet defers the reload', busy.state.reloads, 0);
check('but the update is remembered', busy.state.updateReady, true);

busy.sheetClosed();
check('closing the sheet applies it', busy.state.reloads, 1);

// The other way back: they background the app and come back later.
const later = makeApp({ hadController: true });
later.openSheet();
later.controllerChanged();
check('still deferred while the sheet is open', later.state.reloads, 0);
later.state.sheetOpen = false;            // dismissed by the scrim, say
later.foregrounded();
check('returning to the app applies it', later.state.reloads, 1);

console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
