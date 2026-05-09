// utils/ui/Renderer.js
/**
 * Renderer handles all Canvas drawing logic.
 */
function Renderer(ctx, sysInfo) {
  this.ctx = ctx;
  this.sysInfo = sysInfo;
  this.assets = null;
  this.colors = {
    bg: '#1A1A2E',
    accent: '#E94560',
    cardBg: '#FFFFFF',
    cardRed: '#E74C3C',
    cardBlack: '#2C3E50',
    text: '#FFFFFF',
    textGray: '#888888',
    slotMeBg: [65, 105, 225],
    slotMeBorder: [255, 215, 0],
    slotTeammateBg: [30, 80, 180],
    slotTeammateBorder: [74, 144, 217],
    slotOpponentBg: [180, 50, 50],
    slotOpponentBorder: [217, 74, 74],
    currentArrow: [255, 102, 0],
  };
}

Renderer.prototype.setAssets = function(assets) {
  this.assets = assets;
};

Renderer.prototype.render = function(page, data) {
  const { width, height } = this.sysInfo;
  
  // Draw Background Texture if available
  if (this.assets && this.assets.table) {
    this.ctx.drawImage(this.assets.table, 0, 0, width, height);
  } else {
    this.ctx.fillStyle = this.colors.bg;
    this.ctx.fillRect(0, 0, width, height);
  }

  switch (page) {
    case 'index':
      this.renderIndex(data);
      break;
    case 'game':
      this.renderGame(data);
      break;
    case 'result':
      this.renderResult(data);
      break;
  }
};

Renderer.prototype.renderIndex = function(data) {
  const { width, height } = this.sysInfo;
  const titleSize = Math.max(32, Math.min(48, width * 0.12));
  const subtitleSize = Math.max(16, width * 0.06);
  const btnWidth = Math.min(200, width * 0.5);
  const btnHeight = Math.min(50, height * 0.07);

  // Title
  this.ctx.fillStyle = this.colors.accent;
  this.ctx.font = `bold ${titleSize}px Arial`;
  this.ctx.textAlign = 'center';
  this.ctx.fillText('大怪路子', width / 2, height * 0.2);

  this.ctx.fillStyle = this.colors.text;
  this.ctx.font = `${subtitleSize}px Arial`;
  this.ctx.fillText('3v3 扑克对战', width / 2, height * 0.2 + titleSize * 0.8);

  // Buttons
  const btnStartY = height * 0.45;
  const btnGap = btnHeight + 20;

  this.drawButton(width / 2 - btnWidth / 2, btnStartY, btnWidth, btnHeight, '🎮 开始练习', this.colors.accent);
  this.drawButton(width / 2 - btnWidth / 2, btnStartY + btnGap, btnWidth, btnHeight, '🏠 创建房间', '#4169E1');
  this.drawButton(width / 2 - btnWidth / 2, btnStartY + btnGap * 2, btnWidth, btnHeight, '🚪 加入房间', '#2E8B57');

  this.ctx.fillStyle = this.colors.textGray;
  this.ctx.font = `${Math.max(12, width * 0.03)}px Arial`;
  this.ctx.fillText('练习模式: 1人 vs 5 AI', width / 2, height * 0.85);
};

Renderer.prototype.renderGame = function(data) {
  const { width, height } = this.sysInfo;
  const { state, myPlayerId, selectedCardIds } = data;
  
  if (!state) return;

  const currentPlayerId = state.currentPlayerId || (state.players && state.players[state.currentPlayerIndex]?.id);
  const myIndex = state.players.findIndex(p => p.id === myPlayerId);
  const isMyTurn = currentPlayerId === myPlayerId;
  const myPlayer = state.players[myIndex];
  const myTeam = myPlayer ? myPlayer.team : 0;
  const playerCount = state.players.length;
  
  const getPlayer = (offset) => state.players[(myIndex + offset) % playerCount];

  // Layout constants
  const TABLE_L = width * 0.08;
  const TABLE_R = width * 0.92;
  const TABLE_T = height * 0.12;
  const TABLE_B = height * 0.62;
  const TABLE_W = TABLE_R - TABLE_L;
  const TABLE_H = TABLE_B - TABLE_T;
  const TABLE_CX = width / 2;

  // Render Table Background
  this.ctx.fillStyle = '#2a2a3a';
  this.ctx.fillRect(TABLE_L, TABLE_T, TABLE_W, TABLE_H);
  this.ctx.strokeStyle = '#4a4a6a';
  this.ctx.lineWidth = 2;
  this.ctx.strokeRect(TABLE_L, TABLE_T, TABLE_W, TABLE_H);

  // Render Players
  const SLOT_W = 72;
  const SLOT_H = 48;
  const SLOT_GAP = 12;
  
  // Top 3
  const TOP_ROW_W = SLOT_W * 3 + SLOT_GAP * 2;
  const TOP_ROW_L = TABLE_CX - TOP_ROW_W / 2;
  const TOP_ROW_Y = TABLE_T + 5;
  for (let i = 0; i < 3; i++) {
    const p = getPlayer(i + 3);
    this.drawPlayerSlot(TOP_ROW_L + i * (SLOT_W + SLOT_GAP), TOP_ROW_Y, p, currentPlayerId, myPlayerId, p && p.team === myTeam, SLOT_W, SLOT_H);
  }

  // Sides
  const SIDE_Y = TABLE_T + TABLE_H / 2 - SLOT_H / 2;
  this.drawPlayerSlot(TOP_ROW_L - SLOT_W - 8, SIDE_Y, getPlayer(2), currentPlayerId, myPlayerId, getPlayer(2)?.team === myTeam, SLOT_W, SLOT_H, 'left');
  this.drawPlayerSlot(TOP_ROW_L + TOP_ROW_W + 8, SIDE_Y, getPlayer(1), currentPlayerId, myPlayerId, getPlayer(1)?.team === myTeam, SLOT_W, SLOT_H, 'right');

  // Bottom 2
  const BOTTOM_ROW_W = SLOT_W * 2 + SLOT_GAP;
  const BOTTOM_ROW_L = TABLE_CX - BOTTOM_ROW_W / 2;
  const BOTTOM_ROW_Y = TABLE_B - SLOT_H - 5;
  for (let i = 0; i < 2; i++) {
    const p = getPlayer(i);
    this.drawPlayerSlot(BOTTOM_ROW_L + i * (SLOT_W + SLOT_GAP), BOTTOM_ROW_Y, p, currentPlayerId, myPlayerId, p && p.team === myTeam, SLOT_W, SLOT_H);
  }

  // Render Last Play
  this.renderLastPlay(state, TABLE_CX, TABLE_T + TABLE_H * 0.4, myTeam);

  // Render Hand
  this.renderHand(data.hand, selectedCardIds, width, height, TABLE_B);

  // Render UI Buttons
  if (isMyTurn) {
    this.renderGameButtons(width, height);
  }

  // Status Bar
  this.renderStatusBar(state, isMyTurn, myIndex, width, height);
};

Renderer.prototype.drawPlayerSlot = function(x, y, player, currentPlayerId, myPlayerId, isTeammate, w, h, side) {
  if (!player) return;
  const isCurrent = player.id === currentPlayerId;
  const isMe = player.id === myPlayerId;

  let bgRgb, borderRgb;
  if (isMe) {
    bgRgb = this.colors.slotMeBg;
    borderRgb = this.colors.slotMeBorder;
  } else if (isTeammate) {
    bgRgb = this.colors.slotTeammateBg;
    borderRgb = this.colors.slotTeammateBorder;
  } else {
    bgRgb = this.colors.slotOpponentBg;
    borderRgb = this.colors.slotOpponentBorder;
  }

  if (isCurrent) {
    this.ctx.shadowColor = `rgb(${this.colors.currentArrow})`;
    this.ctx.shadowBlur = 10;
    this.ctx.strokeStyle = `rgb(${this.colors.currentArrow})`;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    this.ctx.shadowBlur = 0;
  }

  this.ctx.fillStyle = `rgba(${bgRgb})`;
  this.ctx.fillRect(x, y, w, h);
  this.ctx.strokeStyle = `rgb(${borderRgb})`;
  this.ctx.lineWidth = isMe ? 2 : 1.5;
  this.ctx.strokeRect(x, y, w, h);

  this.ctx.fillStyle = '#FFF';
  this.ctx.font = isCurrent ? 'bold 12px Arial' : 'bold 11px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText(player.name.substring(0, 4), x + w / 2, y + 17);

  this.ctx.font = '10px Arial';
  this.ctx.fillStyle = '#CCC';
  this.ctx.fillText(player.handCount + '张', x + w / 2, y + 32);

  if (isMe) {
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.fillText('★ 你', x + w / 2, y + 43);
  }
};

Renderer.prototype.renderHand = function(hand, selectedCardIds, width, height, tableBottom) {
  if (!hand) return;
  
  const CARD_W = 38;
  const CARD_H = 56;
  const CARD_GAP_X = -CARD_W * 0.42;
  const CARD_GAP_Y = CARD_H + 2;
  const CARDS_PER_ROW = 12;
  const HAND_AREA_B = height - 65;
  
  const rows = Math.ceil(hand.length / CARDS_PER_ROW);
  const actualHandStartY = HAND_AREA_B - rows * CARD_GAP_Y;

  hand.forEach((card, i) => {
    const row = Math.floor(i / CARDS_PER_ROW);
    const col = i % CARDS_PER_ROW;
    const cardsInRow = Math.min(CARDS_PER_ROW, hand.length - row * CARDS_PER_ROW);
    const rowWidth = cardsInRow * CARD_W + (cardsInRow - 1) * CARD_GAP_X;
    const rowStartX = width / 2 - rowWidth / 2;

    const ix = rowStartX + col * (CARD_W + CARD_GAP_X);
    const iy = actualHandStartY + row * CARD_GAP_Y + (selectedCardIds.has(card.id) ? -12 : 0);
    this.drawCard(ix, iy, CARD_W, CARD_H, card, selectedCardIds.has(card.id));
  });
};

Renderer.prototype.drawCard = function(x, y, w, h, card, isSelected) {
  const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 'Big' || card.rank === 'Small';
  
  this.ctx.fillStyle = isSelected ? '#D0E8FF' : this.colors.cardBg;
  this.ctx.fillRect(x, y, w, h);
  this.ctx.strokeStyle = isSelected ? this.colors.accent : '#CCC';
  this.ctx.lineWidth = isSelected ? 2 : 1;
  this.ctx.strokeRect(x, y, w, h);

  this.ctx.fillStyle = isRed ? this.colors.cardRed : this.colors.cardBlack;
  this.ctx.font = `bold ${Math.floor(w * 0.4)}px Arial`;
  this.ctx.textAlign = 'left';
  this.ctx.fillText(card.rank, x + 2, y + h * 0.3);
  this.ctx.font = `${Math.floor(w * 0.4)}px Arial`;
  this.ctx.fillText(this.getSuitSymbol(card), x + 2, y + h * 0.62);
};

Renderer.prototype.renderLastPlay = function(state, cx, y, myTeam) {
  if (state.lastPlay && state.lastPlay.cards && state.lastPlay.cards.length > 0) {
    const lp = state.players.find(p => p.id === state.lastPlay.playerId);
    const lpIsT = lp && lp.team === myTeam;
    const bannerW = 110;

    this.ctx.fillStyle = lpIsT ? 'rgba(74,144,217,0.85)' : 'rgba(217,74,74,0.85)';
    this.ctx.fillRect(cx - bannerW / 2, y, bannerW, 26);

    this.ctx.fillStyle = '#FFF';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${lp ? lp.name : '?'} 出${state.lastPlay.cards.length}张`, cx, y + 18);

    const lc = 30;
    const lh = 42;
    const lGap = -lc * 0.35;
    const lTotalW = state.lastPlay.cards.length * (lc + lGap) - Math.abs(lGap);
    const lStartX = cx - lTotalW / 2;
    const lY = y + 30;

    state.lastPlay.cards.forEach((card, i) => {
      this.drawCard(lStartX + i * (lc + lGap), lY, lc, lh, card, false);
    });
  }
};

Renderer.prototype.renderGameButtons = function(width, height) {
  const bw = 70;
  const bh = 36;
  const by = height - 55;
  const bCenterX = width / 2;
  const bg = width * 0.06;

  this.drawButton(bCenterX - bw - bg / 2, by, bw, bh, '不出', '#555');
  this.drawButton(bCenterX + bg / 2, by, bw, bh, '出牌', this.colors.accent);
};

Renderer.prototype.renderStatusBar = function(state, isMyTurn, myIndex, width, height) {
  const topBarH = height * 0.07;
  this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
  this.ctx.fillRect(0, 0, width, topBarH);
  
  this.ctx.fillStyle = '#FFD700';
  this.ctx.font = 'bold 13px Arial';
  this.ctx.textAlign = 'left';
  this.ctx.fillText(`级:${state.currentLevel}`, 10, topBarH * 0.7);
  
  this.ctx.textAlign = 'right';
  this.ctx.fillText(state.players[myIndex]?.team === 0 ? '蓝队' : '红队', width - 10, topBarH * 0.7);
  
  this.ctx.textAlign = 'center';
  this.ctx.fillStyle = isMyTurn ? '#00FF00' : '#FFFF00';
  this.ctx.fillText(isMyTurn ? '👉 轮到你了' : (state.players[state.currentPlayerIndex]?.name || '-'), width / 2, topBarH * 0.7);
};

Renderer.prototype.renderResult = function(data) {
  const { width, height } = this.sysInfo;
  const { winningTeam } = data;

  this.ctx.fillStyle = this.colors.accent;
  this.ctx.font = 'bold 42px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText('游戏结束', width / 2, height / 2 - 40);

  this.ctx.fillStyle = this.colors.text;
  this.ctx.font = '28px Arial';
  this.ctx.fillText(`队伍 ${winningTeam + 1} 获胜!`, width / 2, height / 2 + 10);

  this.drawButton(width / 2 - 80, height / 2 + 50, 160, 50, '再来一局', this.colors.accent);
};

Renderer.prototype.drawButton = function(x, y, w, h, text, color) {
  this.ctx.fillStyle = color;
  this.ctx.fillRect(x, y, w, h);

  this.ctx.fillStyle = '#FFFFFF';
  this.ctx.font = '18px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText(text, x + w / 2, y + h / 2 + 6);
};

Renderer.prototype.getSuitSymbol = function(card) {
  if (card.rank === 'Big') return '★';
  if (card.rank === 'Small') return '☆';
  const symbols = { 'Spades': '♠', 'Hearts': '♥', 'Clubs': '♣', 'Diamonds': '♦' };
  return symbols[card.suit] || '';
};

module.exports = Renderer;
