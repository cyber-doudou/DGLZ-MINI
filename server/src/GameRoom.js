// Per-room game state management

const Player = require('./Player');
const MessageTypes = require('./protocol/MessageTypes');

// Simplified rule engine for server-side validation
// In production, use the same rule engine as the client

class GameRoom {
  constructor(roomId, host) {
    this.roomId = roomId;
    this.host = host;
    this.players = [host]; // Array of Player objects
    this.status = 'WAITING'; // WAITING, PLAYING, FINISHED
    this.currentPlayerIndex = 0;
    this.lastPlay = null;
    this.deck = [];
    this.currentLevel = '2';
    this.turnTimer = null;
    this.TURN_TIMEOUT_MS = 30000;

    // Team assignment: 0, 2, 4 are team 0; 1, 3, 5 are team 1
    host.seat = 0;
    host.team = 0;
    host.isHost = true;
    host.isReady = true;
  }

  addPlayer(ws, playerName) {
    if (this.status !== 'WAITING') {
      return { success: false, error: 'Game already started' };
    }

    if (this.players.length >= 6) {
      return { success: false, error: 'Room is full' };
    }

    const player = new Player(ws, playerName);
    const seat = this.players.length;
    player.seat = seat;
    player.team = seat % 2;

    this.players.push(player);

    return { success: true, player };
  }

  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index === -1) return null;

    const player = this.players[index];
    this.players.splice(index, 1);

    // Re-index remaining players
    this.players.forEach((p, i) => {
      p.seat = i;
      p.team = i % 2;
      if (i === 0) {
        p.isHost = true;
      } else {
        p.isHost = false;
      }
    });

    // If game is in progress and host left, transfer host
    if (this.status === 'PLAYING' && this.players.length > 0) {
      this.host = this.players[0];
    }

    return player;
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  broadcast(message, excludePlayerId = null) {
    for (const player of this.players) {
      if (player.id !== excludePlayerId) {
        player.send(message);
      }
    }
  }

  sendToPlayer(playerId, message) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.send(message);
    }
  }

  startGame() {
    if (this.players.length !== 6) {
      return { success: false, error: 'Need 6 players to start' };
    }

    // Initialize game state
    this.status = 'PLAYING';
    this.currentPlayerIndex = 0;
    this.lastPlay = null;
    this.currentLevel = '2';

    // Create and shuffle deck
    this.deck = this.createDeck();
    this.shuffleDeck(this.deck);

    // Deal cards
    this.dealCards();

    // Broadcast game start to all players
    this.broadcast({
      type: MessageTypes.GAME_STARTED,
      payload: this.getGameStateForAll()
    });

    // Send private hands to each player
    for (const player of this.players) {
      player.send({
        type: MessageTypes.GAME_STATE_UPDATE,
        payload: this.getGameStateForPlayer(player.id)
      });
    }

    // Start turn timer
    this.startTurnTimer();

    return { success: true };
  }

  createDeck() {
    const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    // 3 decks
    for (let d = 0; d < 3; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({
            id: `${suit}-${rank}-${d}`,
            suit,
            rank,
            value: this.getRankValue(rank)
          });
        }
      }
    }

    // Add jokers
    deck.push({ id: 'Joker-Small-0', suit: 'Joker', rank: 'Small', value: 99 });
    deck.push({ id: 'Joker-Big-0', suit: 'Joker', rank: 'Big', value: 100 });
    deck.push({ id: 'Joker-Small-1', suit: 'Joker', rank: 'Small', value: 99 });
    deck.push({ id: 'Joker-Big-1', suit: 'Joker', rank: 'Big', value: 100 });

    return deck;
  }

  getRankValue(rank) {
    const values = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || 0;
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  dealCards() {
    const cardsPerPlayer = Math.floor(this.deck.length / 6);
    for (let i = 0; i < 6; i++) {
      const start = i * cardsPerPlayer;
      const end = start + cardsPerPlayer;
      this.players[i].setHand(this.deck.slice(start, end));
    }
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getCurrentPlayerId() {
    const player = this.getCurrentPlayer();
    return player ? player.id : null;
  }

  advanceTurn() {
    this.clearTurnTimer();

    // Find next player who hasn't finished
    let nextIndex = (this.currentPlayerIndex + 1) % 6;
    let attempts = 0;

    while (attempts < 6) {
      if (this.players[nextIndex].handCount > 0) {
        break;
      }
      nextIndex = (nextIndex + 1) % 6;
      attempts++;
    }

    this.currentPlayerIndex = nextIndex;

    this.broadcast({
      type: MessageTypes.TURN_CHANGED,
      payload: { currentPlayerId: this.getCurrentPlayerId() }
    });

    this.startTurnTimer();
  }

  playCards(playerId, cards) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (player.id !== this.getCurrentPlayerId()) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate cards are in player's hand
    const cardIds = new Set(cards.map(c => c.id));
    const validCards = player.hand.filter(c => cardIds.has(c.id));

    if (validCards.length !== cards.length) {
      return { success: false, error: 'Invalid cards' };
    }

    // Update player's hand
    player.setHand(player.hand.filter(c => !cardIds.has(c.id)));

    // Update last play
    this.lastPlay = {
      playerId: player.id,
      cards: cards,
      timestamp: Date.now()
    };

    // Broadcast the play
    this.broadcast({
      type: MessageTypes.CARDS_PLAYED,
      payload: {
        playerId: player.id,
        cards: cards,
        gameState: this.getPublicGameState()
      }
    });

    // Check if player finished
    if (player.handCount === 0) {
      // Player finished - handle finish
      // For simplicity, we'll just advance turn
    }

    // Advance to next turn
    this.advanceTurn();

    return { success: true };
  }

  pass(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (player.id !== this.getCurrentPlayerId()) {
      return { success: false, error: 'Not your turn' };
    }

    this.broadcast({
      type: MessageTypes.PLAYER_PASSED,
      payload: { playerId: player.id }
    });

    this.advanceTurn();

    return { success: true };
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer) {
        this.pass(currentPlayer.id);
      }
    }, this.TURN_TIMEOUT_MS);
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  getGameStateForAll() {
    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players.map(p => p.toJSON()),
      currentPlayerId: this.getCurrentPlayerId(),
      currentLevel: this.currentLevel,
      lastPlay: this.lastPlay ? {
        playerId: this.lastPlay.playerId,
        cards: this.lastPlay.cards
      } : null
    };
  }

  getGameStateForPlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players.map(p => p.toJSON()),
      currentPlayerId: this.getCurrentPlayerId(),
      currentLevel: this.currentLevel,
      lastPlay: this.lastPlay ? {
        playerId: this.lastPlay.playerId,
        cards: this.lastPlay.cards
      } : null,
      myHand: player.hand,
      myPlayerId: playerId
    };
  }

  getPublicGameState() {
    return this.getGameStateForAll();
  }

  destroy() {
    this.clearTurnTimer();
    this.status = 'FINISHED';
  }
}

module.exports = GameRoom;
