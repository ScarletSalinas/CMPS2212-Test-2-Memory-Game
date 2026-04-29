// ============================================================================
// ui.js — View Layer (the Observer in Observer Pattern)
// ============================================================================
//
// LAYER RULES
//
//   1. This file is the ONLY place allowed to touch the DOM.
//
//   2. This file MUST NOT contain any game logic. No match checking, no
//      move counting, no timer state. If you need to know something about
//      the game, either the service emits it in an event payload, or
//      you are doing it wrong.
//
//   3. Communicate with the service only by calling its public methods
//      (gameService.start, gameService.flipCard, gameService.restart).
//      Never read or mutate service state directly.
//
// ============================================================================
// EVENT SUBSCRIPTIONS YOU WILL WIRE UP
//
//   'game:started'           → renderBoard(cards), resetHud(totalPairs), hideWinOverlay()
//   'game:cardFlipped'       → flipCardFaceUp(cardId)
//   'game:matchFound'        → markCardsMatched(firstId, secondId), updateMatchedCount(matchedCount)
//   'game:matchFailed'       → after FLIP_BACK_DELAY_MS, flipCardsFaceDown(firstId, secondId)
//                               (use the same 900ms the service uses; a constant is defined below)
//   'game:moveCountChanged'  → updateMoves(moves)
//   'game:timerTick'         → updateTimer(elapsedSeconds)
//   'game:won'               → showWinOverlay(moves, elapsedSeconds)
//
// ============================================================================

const FLIP_BACK_DELAY_MS = 900;
const TOTAL_PAIRS = 18;

/**
 * Factory: builds the UI controller and wires it to the given bus and service.
 *
 * @param {object} eventBus      from createEventEmitter()
 * @param {object} gameService   from createGameService(bus)
 * @param {HTMLElement} rootEl   usually document.body
 * @returns {object} { mount, unmount }
 */
export function createUI(eventBus, gameService, rootEl) {
  // -------------------------------------------------------------------------
  // DOM element cache — resolved once on mount.
  // -------------------------------------------------------------------------
  const els = {
    board:       null,
    moves:       null,
    timer:       null,
    matched:     null,
    restart:     null,
    playAgain:   null,
    winOverlay:  null,
    winMoves:    null,
    winTime:     null,
  };

  // Track the subscriptions we create so we can clean them up in unmount().
  // Each entry: { event: string, handler: Function }
  const subscriptions = [];

  // -------------------------------------------------------------------------
  // Small formatting helpers (pure — safe to keep here, not game logic).
  // -------------------------------------------------------------------------
  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // -------------------------------------------------------------------------
  // RENDERERS — produce / mutate DOM based on payloads. Students implement.
  // -------------------------------------------------------------------------

  /**
   * Build a single card element for the given card object.
   * Expected structure (matches styles.css):
   *
   *   <button class="card" data-card-id="<id>" type="button">
   *     <div class="card-inner">
   *       <div class="card-face card-back"></div>
   *       <div class="card-face card-front"><span>🦜</span></div>
   *     </div>
   *   </button>
   *
   * Security note: use textContent, never innerHTML, when inserting the
   * symbol. Treat all payload data as untrusted on principle.
   */
  function buildCardElement(card) {
    // TODO (1):
    //   - Create a <button> with class "card", type="button",
    const button = document.createElement("button");
    button.classList.add("card");
    button.type = "button";
    button.dataset.cardId = card.id; // data-card-id set to card.id.
    
    //   - Build the nested .card-inner, .card-back, .card-front, <span>.
    const cardInner = document.createElement("div");
    cardInner.classList.add("card-inner");

    const cardBack = document.createElement("div");
    cardBack.classList.add("card-face", "card-back");

    const cardFront = document.createElement("div");
    cardFront.classList.add("card-face", "card-front");
    
    const symbolSpan = document.createElement("span");
    //   - Set the span's textContent to card.symbol.
    symbolSpan.textContent = card.symbol;

    //   - Return the button element.
    cardFront.appendChild(symbolSpan);
    cardInner.appendChild(cardBack);
    cardInner.appendChild(cardFront);
    button.appendChild(cardInner);
    return button;
  }

  /**
   * Replace the board's contents with freshly rendered cards.
   * Called on 'game:started'.
   */
  function renderBoard(cards) {
    // TODO (2):
    //   - Clear els.board (replaceChildren with nothing is fine).
    els.board.replaceChildren();
    //   - For each card, build its element and append.
    //   - For performance, build into a DocumentFragment first, then
    //     append the fragment once.
    const fragment = document.createDocumentFragment();
    cards.forEach((card) => {
      const cardElement = buildCardElement(card);
      fragment.appendChild(cardElement);
    });
    els.board.appendChild(fragment);

  }

  /**
   * Reset the HUD for a new game.
   */
  function resetHud(totalPairs) {
    // TODO (3):
    //   - Set moves display to "0".
    els.moves.textContent = "0";
    //   - Set timer display to "0:00".
    els.timer.textContent = "0:00";
    //   - Set matched display to `0 / ${totalPairs}`.
    els.matched.textContent = `0 / ${totalPairs}`;
  }

  function updateMoves(moves) {
    // TODO (4): set els.moves.textContent to moves (coerced to string).
    els.moves.textContent = String(moves);
  }

  function updateTimer(elapsedSeconds) {
    // TODO (5): set els.timer.textContent using formatTime(elapsedSeconds).
    els.timer.textContent = formatTime(elapsedSeconds);
  }

  function updateMatchedCount(matchedCardCount) {
    // TODO (6):
    //   - matchedCardCount is CARDS matched, not pairs. Divide by 2.
    const pairs = matchedCardCount / 2;
    //   - Set els.matched.textContent to `${pairs} / ${TOTAL_PAIRS}`.
    els.matched.textContent = `${pairs} / ${TOTAL_PAIRS}`;

  }

  /**
   * Find the card element by id and add the .is-flipped class.
   */
  function flipCardFaceUp(cardId) {
    // TODO (7):
    //   - Query els.board for `[data-card-id="${cardId}"]`.
    const cardElement = els.board.querySelector(`[data-card-id="${cardId}"]`);
    //   - If found, add the 'is-flipped' class.
    //   - Guard against missing nodes (don't throw if the element is gone).
    if (cardElement) {
      cardElement.classList.add("is-flipped");
    }

  }

  /**
   * Mark both cards as matched. Once matched they should stay face-up
   * permanently, so we keep .is-flipped AND add .is-matched.
   */
  function markCardsMatched(firstId, secondId) {
    // TODO (8): add 'is-matched' class to both cards' elements.
    //           (They already have 'is-flipped' from the earlier event.)
    const firstCardElement = els.board.querySelector(`[data-card-id="${firstId}"]`);
    const secondCardElement = els.board.querySelector(`[data-card-id="${secondId}"]`);
    if (firstCardElement) {
      firstCardElement.classList.add("is-matched");
    }
    if (secondCardElement) {
      secondCardElement.classList.add("is-matched");
    }
  }

  /**
   * Flip two unmatched cards back face-down after the viewing delay.
   * Called on 'game:matchFailed' via setTimeout.
   */
  function flipCardsFaceDown(firstId, secondId) {
    // TODO (9): remove 'is-flipped' from both card elements.
    const firstCardElement = els.board.querySelector(`[data-card-id="${firstId}"]`);
    const secondCardElement = els.board.querySelector(`[data-card-id="${secondId}"]`);
    if (firstCardElement) {
      firstCardElement.classList.remove("is-flipped");
    }
    if (secondCardElement) {
      secondCardElement.classList.remove("is-flipped");
    }
  }

  function showWinOverlay(moves, elapsedSeconds) {
    // TODO (10):
    //   - Set els.winMoves.textContent to moves.
    els.winMoves.textContent = String(moves);
    //   - Set els.winTime.textContent to formatTime(elapsedSeconds).
    els.winTime.textContent = formatTime(elapsedSeconds);
    //   - Add 'is-visible' class to els.winOverlay.
    els.winOverlay.classList.add("is-visible");
    //   - Set aria-hidden="false" on els.winOverlay.
    els.winOverlay.setAttribute("aria-hidden", "false");
  }

  function hideWinOverlay() {
    // TODO (11):
    //   - Remove 'is-visible' class from els.winOverlay.
    els.winOverlay.classList.remove("is-visible");
    //   - Set aria-hidden="true" on els.winOverlay.
    els.winOverlay.setAttribute("aria-hidden", "true");

  }

  // -------------------------------------------------------------------------
  // DOM EVENT HANDLERS — user input → service method calls
  // -------------------------------------------------------------------------

  /**
   * Click on the board. Use event delegation: one listener on the board,
   * figure out which card was clicked via the event target.
   */
  function onBoardClick(domEvent) {
    // TODO (12):
    //   - Find the closest .card ancestor of domEvent.target using
    //     .closest('.card'). If none, return.
    const cardElement = domEvent.target.closest(".card");
    if (!cardElement) {
      return;
    }
    //   - Read its data-card-id attribute, convert to Number.
    const cardId = Number(cardElement.dataset.cardId);
    //   - If no valid id, return.
    if (isNaN(cardId)) {
      return;
    }
    //   - Call gameService.flipCard(id).
    gameService.flipCard(cardId);
    //
    //   DO NOT check any game rules here. The service decides whether
    //   a flip is valid. The UI just forwards the intent.

  }

  function onRestartClick() {
    // TODO (13): call gameService.restart().
    gameService.restart();
  }

  // -------------------------------------------------------------------------
  // SUBSCRIPTION WIRING — Observer Pattern subscriptions live here.
  // -------------------------------------------------------------------------

  /**
   * Subscribe a handler and remember it so unmount() can detach cleanly.
   * Use this helper instead of calling eventBus.on directly.
   */
  function subscribe(eventName, handler) {
    eventBus.on(eventName, handler);
    subscriptions.push({ event: eventName, handler });
  }

  function wireSubscriptions() {
    // TODO (14): subscribe to every event in the contract above.
    //   Each subscription should call the corresponding renderer with
    //   the right fields from the payload.
    //
    //   Example (do this for each event):
    //     subscribe('game:moveCountChanged', ({ moves }) => updateMoves(moves));
    //
    //   For 'game:matchFailed', remember to setTimeout the flip-back
    //   by FLIP_BACK_DELAY_MS before calling flipCardsFaceDown.

    subscribe('game:started', ({ cards }) => {
      renderBoard(cards); 
      resetHud(TOTAL_PAIRS); //
      hideWinOverlay();
    });

    subscribe('game:matchFound', ({ firstId, secondId, matchedCount }) => {
      markCardsMatched(firstId, secondId);
      updateMatchedCount(matchedCount);
    });

    subscribe('game:matchFailed', ({ firstId, secondId }) => {
      setTimeout(() => flipCardsFaceDown(firstId, secondId), FLIP_BACK_DELAY_MS);
    });

    subscribe('game:moveCountChanged', ({ moves }) => updateMoves(moves));
    subscribe('game:timerTick', ({ elapsedSeconds }) => updateTimer(elapsedSeconds));
    subscribe('game:won', ({ moves, elapsedSeconds }) => showWinOverlay(moves, elapsedSeconds));
    subscribe('game:cardFlipped', ({ cardId }) => flipCardFaceUp(cardId));

   
  }

  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  function mount() {
    // Resolve DOM refs.
    els.board      = rootEl.querySelector('[data-role="board"]');
    els.moves      = rootEl.querySelector('[data-role="moves"]');
    els.timer      = rootEl.querySelector('[data-role="timer"]');
    els.matched    = rootEl.querySelector('[data-role="matched"]');
    els.restart    = rootEl.querySelector('[data-role="restart"]');
    els.playAgain  = rootEl.querySelector('[data-role="play-again"]');
    els.winOverlay = rootEl.querySelector('[data-role="win-overlay"]');
    els.winMoves   = rootEl.querySelector('[data-role="win-moves"]');
    els.winTime    = rootEl.querySelector('[data-role="win-time"]');

    // Attach DOM listeners.
    els.board.addEventListener('click', onBoardClick);
    els.restart.addEventListener('click', onRestartClick);
    els.playAgain.addEventListener('click', onRestartClick);

    // Subscribe to service events.
    wireSubscriptions();
  }

  function unmount() {
    // Detach DOM listeners.
    els.board.removeEventListener('click', onBoardClick);
    els.restart.removeEventListener('click', onRestartClick);
    els.playAgain.removeEventListener('click', onRestartClick);

    // Detach all bus subscriptions we created.
    subscriptions.forEach(({ event, handler }) => eventBus.off(event, handler));
    subscriptions.length = 0;
  }

  return Object.freeze({ mount, unmount });
}
