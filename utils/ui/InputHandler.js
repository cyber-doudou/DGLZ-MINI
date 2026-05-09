// utils/ui/InputHandler.js
/**
 * InputHandler manages touch events and translates them into game actions.
 */
function InputHandler(sysInfo) {
  this.sysInfo = sysInfo;
  this.callbacks = {};
}

InputHandler.prototype.on = function(event, callback) {
  this.callbacks[event] = callback;
};

InputHandler.prototype.handleTap = function(x, y, currentPage, gameData) {
  const { windowWidth: width, windowHeight: height } = this.sysInfo;

  if (currentPage === 'index') {
    this.handleIndexTap(x, y, width, height);
  } else if (currentPage === 'game') {
    this.handleGameTap(x, y, width, height, gameData);
  } else if (currentPage === 'result') {
    this.handleResultTap(x, y, width, height);
  }
};

InputHandler.prototype.handleIndexTap = function(x, y, width, height) {
  const btnWidth = Math.min(200, width * 0.5);
  const btnHeight = Math.min(50, height * 0.07);
  const btnStartY = height * 0.45;
  const btnGap = btnHeight + 20;

  if (x >= width / 2 - btnWidth / 2 && x <= width / 2 + btnWidth / 2) {
    if (y >= btnStartY && y <= btnStartY + btnHeight) {
      if (this.callbacks.startGame) this.callbacks.startGame();
    } else if (y >= btnStartY + btnGap && y <= btnStartY + btnGap + btnHeight) {
      if (this.callbacks.createRoom) this.callbacks.createRoom();
    } else if (y >= btnStartY + btnGap * 2 && y <= btnStartY + btnGap * 2 + btnHeight) {
      if (this.callbacks.joinRoom) this.callbacks.joinRoom();
    }
  }
};

InputHandler.prototype.handleGameTap = function(x, y, width, height, data) {
  const { isMyTurn, hand, selectedCardIds } = data;
  if (!isMyTurn) return;

  // Button logic
  const bw = 70;
  const bh = 36;
  const by = height - 55;
  const bCenterX = width / 2;
  const bg = width * 0.06;

  if (x >= bCenterX - bw - bg / 2 && x <= bCenterX - bw - bg / 2 + bw && y >= by && y <= by + bh) {
    if (this.callbacks.onPass) this.callbacks.onPass();
    return;
  }
  if (x >= bCenterX + bg / 2 && x <= bCenterX + bg / 2 + bw && y >= by && y <= by + bh) {
    if (this.callbacks.onPlay) this.callbacks.onPlay();
    return;
  }

  // Card logic
  const CARD_W = 38;
  const CARD_H = 56;
  const CARD_GAP_X = -CARD_W * 0.42;
  const CARD_GAP_Y = CARD_H + 2;
  const CARDS_PER_ROW = 12;
  const HAND_AREA_B = height - 65;
  const rows = Math.ceil(hand.length / CARDS_PER_ROW);
  const actualHandStartY = HAND_AREA_B - rows * CARD_GAP_Y;

  for (let i = hand.length - 1; i >= 0; i--) {
    const card = hand[i];
    const row = Math.floor(i / CARDS_PER_ROW);
    const col = i % CARDS_PER_ROW;
    const cardsInRow = Math.min(CARDS_PER_ROW, hand.length - row * CARDS_PER_ROW);
    const rowWidth = cardsInRow * CARD_W + (cardsInRow - 1) * CARD_GAP_X;
    const rowStartX = width / 2 - rowWidth / 2;

    const ix = rowStartX + col * (CARD_W + CARD_GAP_X);
    const iy = actualHandStartY + row * CARD_GAP_Y + (selectedCardIds.has(card.id) ? -12 : 0);

    if (x >= ix && x <= ix + CARD_W && y >= iy && y <= iy + CARD_H) {
      if (this.callbacks.toggleCard) this.callbacks.toggleCard(card.id);
      break;
    }
  }
};

InputHandler.prototype.handleResultTap = function(x, y, width, height) {
  const btnWidth = 160;
  const btnHeight = 50;
  const btnX = width / 2 - btnWidth / 2;
  const btnY = height / 2 + 50;
  if (x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight) {
    if (this.callbacks.startGame) this.callbacks.startGame();
  }
};

module.exports = InputHandler;
