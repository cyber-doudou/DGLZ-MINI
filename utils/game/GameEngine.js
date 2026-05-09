// utils/game/GameEngine.js
// Local game state manager for single-player mode

const DaGuaiLuZiRule = require('./DaGuaiLuZiRule.js');
const { DEFAULT_DECK_COUNT, DEFAULT_PLAYER_COUNT, CARDS_PER_PLAYER } = require('./constants.js');

function GameEngine() {
  this.ruleEngine = new DaGuaiLuZiRule();
  this.state = null;
  this.myPlayerId = null;
}

/**
 * Start a new game with specified number of players
 * @param {number} playerCount
 * @returns {{state: Object, myPlayerId: string}}
 */
GameEngine.prototype.startNewGame = function(playerCount) {
  playerCount = playerCount || DEFAULT_PLAYER_COUNT;

  // Create 6 players
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: `player-${i}`,
      name: `玩家${i + 1}`,
      avatar: '',
      isReady: true,
      isHost: i === 0,
      isOnline: true,
      isAutoPlay: i !== 0, // Only first player is human
      handCount: 0,
      hand: [],
      team: i % 2 // Alternate teams: 0, 1, 0, 1, 0, 1
    });
  }

  // Initialize state
  this.state = {
    roomId: 'LOCAL',
    status: 'Playing',
    players: players,
    currentPlayerIndex: 0,
    lastPlay: null,
    history: [],
    deckCount: DEFAULT_DECK_COUNT,
    cutPlayerIndex: null,
    currentLevel: '2',
    team1Level: '2',
    team2Level: '2',
    currentBankerTeam: 0,
    settings: {
      deckCount: DEFAULT_DECK_COUNT,
      allowSpecificCombinations: true
    },
    finishOrder: [],
    tribute: null,
    lastGameResult: null
  };

  // Set human player
  this.myPlayerId = players[0].id;

  // Deal cards
  this.dealCards_();

  return { state: this.getSanitizedState(), myPlayerId: this.myPlayerId };
};

/**
 * Deal cards to all players
 * @private
 */
GameEngine.prototype.dealCards_ = function() {
  const deck = this.ruleEngine.createDeck(this.state.settings, this.state.currentLevel);
  const hands = this.ruleEngine.dealCards(deck, this.state.players.length);

  for (let i = 0; i < this.state.players.length; i++) {
    const sortedHand = this.ruleEngine.sortCards(hands[i], 'value', this.state.currentLevel);
    this.state.players[i].hand = sortedHand;
    this.state.players[i].handCount = sortedHand.length;
  }
};

/**
 * Get sanitized state (hides other players' cards)
 * @returns {Object}
 */
GameEngine.prototype.getSanitizedState = function() {
  const sanitized = { ...this.state };
  sanitized.players = this.state.players.map(p => {
    if (p.id === this.myPlayerId) {
      return { ...p }; // Show full hand
    }
    return {
      ...p,
      hand: undefined // Hide hand from others
    };
  });
  return sanitized;
};

/**
 * Get current state
 * @returns {Object}
 */
GameEngine.prototype.getState = function() {
  return this.getSanitizedState();
};

/**
 * Get my actual hand
 * @returns {Array}
 */
GameEngine.prototype.getMyHand = function() {
  const me = this.state.players.find(p => p.id === this.myPlayerId);
  return me ? me.hand || [] : [];
};

/**
 * Check if it's my turn
 * @returns {boolean}
 */
GameEngine.prototype.isMyTurn = function() {
  const currentPlayer = this.state.players[this.state.currentPlayerIndex];
  return currentPlayer && currentPlayer.id === this.myPlayerId;
};

/**
 * Get current player ID
 * @returns {string}
 */
GameEngine.prototype.getCurrentPlayerId = function() {
  const currentPlayer = this.state.players[this.state.currentPlayerIndex];
  return currentPlayer ? currentPlayer.id : null;
};

/**
 * Play cards
 * @param {string} playerId
 * @param {Array} cards
 * @returns {boolean}
 */
GameEngine.prototype.playCards = function(playerId, cards) {
  if (this.state.status !== 'Playing') return false;

  const playerIndex = this.state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1 || playerIndex !== this.state.currentPlayerIndex) {
    return false;
  }

  const player = this.state.players[playerIndex];

  // Validate play
  if (cards.length > 0) {
    if (!this.ruleEngine.validatePlay(cards, this.state.lastPlay, player.hand, this.state.currentLevel)) {
      return false;
    }

    // Check Big Joker reset
    const isBigJoker = cards.length === 1 && cards[0].rank === 'Big';

    // Remove cards from hand
    const cardIds = new Set(cards.map(c => c.id));
    player.hand = player.hand.filter(c => !cardIds.has(c.id));
    player.handCount = player.hand.length;

    // Record play
    const playAction = {
      playerId: playerId,
      cards: cards,
      playType: this.ruleEngine.getPlayType(cards, this.state.currentLevel) || 'Unknown'
    };

    this.state.history.push(playAction);
    this.state.lastPlay = isBigJoker ? null : playAction;

    // Check if player finished
    if (player.hand.length === 0) {
      this.state.finishOrder.push(playerId);
    }
  } else {
    // Pass
    if (!this.state.lastPlay || this.state.lastPlay.cards.length === 0) {
      return false; // Can't pass when leading
    }

    this.state.history.push({
      playerId: playerId,
      cards: [],
      playType: 'Pass'
    });
  }

  // Advance turn
  this.advanceTurn_();

  // Check game over
  if (this.state.finishOrder.length === this.state.players.length - 1) {
    this.endGame_();
  }

  return true;
};

/**
 * Pass (shorthand for playing empty cards)
 * @param {string} playerId
 * @returns {boolean}
 */
GameEngine.prototype.pass = function(playerId) {
  return this.playCards(playerId, []);
};

/**
 * Advance to next player
 * @private
 */
GameEngine.prototype.advanceTurn_ = function() {
  let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
  let attempts = 0;

  while (this.state.finishOrder.includes(this.state.players[nextIndex].id) && attempts < this.state.players.length) {
    nextIndex = (nextIndex + 1) % this.state.players.length;
    attempts++;
  }

  this.state.currentPlayerIndex = nextIndex;

  // If all remaining players passed, clear lastPlay (new trick)
  if (this.state.lastPlay && this.state.lastPlay.cards.length > 0) {
    const lastPlayIndex = this.state.players.findIndex(p => p.id === this.state.lastPlay.playerId);
    const activePlayers = this.state.players.filter(p => !this.state.finishOrder.includes(p.id));

    // Count consecutive passes since last play
    let passesSinceLastPlay = 0;
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      const action = this.state.history[i];
      if (action.cards.length === 0) {
        passesSinceLastPlay++;
      } else {
        break;
      }
    }

    // If all active players passed, clear lastPlay
    if (passesSinceLastPlay >= activePlayers.length - 1) {
      this.state.lastPlay = null;
    }
  }
};

/**
 * End the game
 * @private
 */
GameEngine.prototype.endGame_ = function() {
  this.state.status = 'Finished';

  // Determine winning team
  const finishedPlayers = this.state.finishOrder.map(id =>
    this.state.players.find(p => p.id === id)
  );

  if (finishedPlayers.length > 0) {
    const firstPlace = finishedPlayers[0];
    const lastPlace = finishedPlayers[finishedPlayers.length - 1];

    let winningTeam = null;
    if (firstPlace && lastPlace) {
      if (firstPlace.team === lastPlace.team) {
        winningTeam = firstPlace.team;
      } else {
        // First place team wins
        winningTeam = firstPlace.team;
      }
    }

    this.state.lastGameResult = {
      winningTeam: winningTeam,
      firstPlaceId: this.state.finishOrder[0],
      shutOutPlayerIds: [],
      receivers: []
    };
  }
};

/**
 * Find legal choices for a player
 * @param {string} playerId
 * @returns {Array}
 */
GameEngine.prototype.findLegalChoices = function(playerId) {
  const player = this.state.players.find(p => p.id === playerId);
  if (!player) return [];

  return this.ruleEngine.findLegalChoices(
    player.hand,
    this.state,
    playerId,
    {}
  );
};

/**
 * Set a player as AI
 * @param {string} playerId
 * @param {boolean} isAI
 */
GameEngine.prototype.setPlayerAsAI = function(playerId, isAI) {
  const player = this.state.players.find(p => p.id === playerId);
  if (player) {
    player.isAutoPlay = isAI;
  }
};

/**
 * Set all other players as AI (for single player mode)
 */
GameEngine.prototype.setAllOthersAsAI = function() {
  for (const player of this.state.players) {
    if (player.id !== this.myPlayerId) {
      player.isAutoPlay = true;
    }
  }
};

/**
 * Get a specific player's hand (unrestricted)
 * @param {string} playerId
 * @returns {Array}
 */
GameEngine.prototype.getPlayerHand = function(playerId) {
  const player = this.state.players.find(p => p.id === playerId);
  return player ? player.hand || [] : [];
};

/**
 * Sync state from server (for multiplayer mode)
 * @param {Object} serverState
 */
GameEngine.prototype.syncState = function(serverState) {
  if (!serverState) return;

  this.state = {
    ...this.state,
    ...serverState
  };

  // Update myPlayerId from server state if available
  if (serverState.myPlayerId) {
    this.myPlayerId = serverState.myPlayerId;
  }

  // Ensure all players have proper handCount
  for (const player of this.state.players) {
    if (player.hand && player.hand.length > 0) {
      player.handCount = player.hand.length;
    }
  }
};

module.exports = GameEngine;
