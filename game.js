// game.js - Refactored for Modularity
const GameEngine = require('./utils/game/GameEngine.js');
const AIService = require('./utils/ai/AIService.js');
const Renderer = require('./utils/ui/Renderer.js');
const InputHandler = require('./utils/ui/InputHandler.js');
const AssetLoader = require('./utils/ui/AssetLoader.js');

let canvas, ctx;
let gameEngine, aiService, renderer, inputHandler, assetLoader;
let currentPage = 'index';
let myPlayerId = null;
let sysInfo = null;
let selectedCardIds = new Set();

const ASSETS_TO_LOAD = {
  table: 'assets/table.png',
  cardBack: 'assets/card_back.png'
};

function init() {
  console.log('大怪路子小游戏启动 (Modular Version)');

  try {
    const info = wx.getSystemInfoSync();
    sysInfo = info;
  } catch (e) {
    sysInfo = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };
  }

  canvas = wx.createCanvas();
  canvas.width = sysInfo.windowWidth;
  canvas.height = sysInfo.windowHeight;
  ctx = canvas.getContext('2d');

  // Initialize Modules
  gameEngine = new GameEngine();
  aiService = new AIService(gameEngine);
  renderer = new Renderer(ctx, sysInfo);
  inputHandler = new InputHandler(sysInfo);
  assetLoader = new AssetLoader();

  // Bind Input Callbacks
  setupInputHandlers();

  // Load Assets
  assetLoader.load(ASSETS_TO_LOAD, (assets) => {
    console.log('Assets loaded');
    renderer.setAssets(assets);
    render();
  });

  // Touch Event
  wx.onTouchStart((e) => {
    const touch = e.touches[0];
    if (touch) {
      const gameData = {
        state: gameEngine.getState(),
        myPlayerId,
        selectedCardIds,
        hand: gameEngine.getMyHand(),
        isMyTurn: gameEngine.isMyTurn()
      };
      inputHandler.handleTap(touch.clientX, touch.clientY, currentPage, gameData);
    }
  });

  currentPage = 'index';
  render();
}

function setupInputHandlers() {
  inputHandler.on('startGame', () => {
    currentPage = 'game';
    selectedCardIds.clear();
    const result = gameEngine.startNewGame(6);
    gameEngine.setAllOthersAsAI();
    myPlayerId = result.myPlayerId;
    render();
    gameLoop();
  });

  inputHandler.on('toggleCard', (cardId) => {
    if (selectedCardIds.has(cardId)) {
      selectedCardIds.delete(cardId);
    } else {
      selectedCardIds.add(cardId);
    }
    render();
  });

  inputHandler.on('onPlay', () => {
    const hand = gameEngine.getMyHand();
    const selectedCards = hand.filter(c => selectedCardIds.has(c.id));

    if (selectedCards.length === 0) {
      wx.showToast({ title: '请选择卡牌', icon: 'none' });
      return;
    }

    const success = gameEngine.playCards(myPlayerId, selectedCards);
    if (success) {
      selectedCardIds.clear();
      render();
      gameLoop();
    } else {
      wx.showToast({ title: '出牌无效', icon: 'none' });
    }
  });

  inputHandler.on('onPass', () => {
    if (gameEngine.pass(myPlayerId)) {
      render();
      gameLoop();
    }
  });
}

function gameLoop() {
  if (currentPage !== 'game') return;

  const state = gameEngine.getState();
  if (state.status === 'Finished') {
    currentPage = 'result';
    render();
    return;
  }

  const currentPlayerId = gameEngine.getCurrentPlayerId();
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);

  if (currentPlayer && currentPlayer.isAutoPlay) {
    setTimeout(() => {
      try {
        const decision = aiService.getAIDecision(currentPlayerId, state);
        if (decision && decision.cards && decision.cards.length > 0) {
          gameEngine.playCards(currentPlayerId, decision.cards);
        } else {
          gameEngine.pass(currentPlayerId);
        }
        render();
        gameLoop();
      } catch (e) {
        console.error('AI error:', e);
        gameEngine.pass(currentPlayerId);
        render();
        gameLoop();
      }
    }, 800 + Math.random() * 400);
  }
}

function render() {
  const gameData = {
    state: gameEngine.getState(),
    myPlayerId,
    selectedCardIds,
    hand: gameEngine.getMyHand(),
    winningTeam: gameEngine.getState().lastGameResult?.winningTeam
  };
  renderer.render(currentPage, gameData);
}

// Start
init();
