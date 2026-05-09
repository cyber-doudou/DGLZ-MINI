// utils/ai/GameMemory.js
// Tracks complete game history for opponent modeling

const CardTypeTracker = require('./CardTypeTracker.js');

function GameMemory(ruleEngine) {
  this.ruleEngine = ruleEngine;
  this.profiles = new Map();
  this.allPlayedCards = [];
  this.processedHistoryLength = 0;
  this.cardTypeTracker = new CardTypeTracker(ruleEngine);
}

/**
 * Reset memory for a new game
 */
GameMemory.prototype.reset = function() {
  this.profiles.clear();
  this.allPlayedCards = [];
  this.processedHistoryLength = 0;
  this.cardTypeTracker.reset();
};

/**
 * Get CardTypeTracker for opponent modeling
 */
GameMemory.prototype.getCardTypeTracker = function() {
  return this.cardTypeTracker;
};

/**
 * Initialize player profiles
 * @param {Array} players - [{id, team, handCount}]
 */
GameMemory.prototype.initPlayers = function(players) {
  for (const p of players) {
    if (!this.profiles.has(p.id)) {
      this.profiles.set(p.id, {
        playerId: p.id,
        team: p.team,
        handCount: p.handCount,
        cardsPlayed: [],
        highCardsPlayed: 0,
        lowCardsPlayed: 0,
        bombsPlayed: 0,
        passCount: 0,
        totalPlays: 0,
        estimatedStrength: 50,
      });
    }
    // Update hand count
    const profile = this.profiles.get(p.id);
    profile.handCount = p.handCount;
  }
};

/**
 * Update from history
 * @param {Array} history
 * @param {string} currentLevel
 * @param {Array} players
 */
GameMemory.prototype.updateFromHistory = function(history, currentLevel, players) {
  this.initPlayers(players);

  // Process new entries
  for (let i = this.processedHistoryLength; i < history.length; i++) {
    const action = history[i];
    const profile = this.profiles.get(action.playerId);
    if (!profile) continue;

    profile.totalPlays++;

    if (action.cards.length === 0) {
      profile.passCount++;
    } else {
      for (const card of action.cards) {
        profile.cardsPlayed.push(card);
        this.allPlayedCards.push(card);

        const value = this.ruleEngine.getRankValue(card.rank, currentLevel);
        if (value >= 13) {
          profile.highCardsPlayed++;
        } else if (value < 10) {
          profile.lowCardsPlayed++;
        }
      }

      if (action.playType === 'Bomb' || action.playType === 'StraightFlush') {
        profile.bombsPlayed++;
      }
    }
  }

  this.processedHistoryLength = history.length;

  // Update CardTypeTracker
  this.cardTypeTracker.updateFromHistory(history, currentLevel, players);

  // Update strength estimates
  this.updateStrengthEstimates(currentLevel);
};

/**
 * Update strength estimates
 * @param {string} currentLevel
 */
GameMemory.prototype.updateStrengthEstimates = function(currentLevel) {
  for (const [id, profile] of this.profiles) {
    if (profile.handCount === 0) {
      profile.estimatedStrength = 0;
      continue;
    }

    let strength = 50;

    const totalPlayed = profile.cardsPlayed.length;
    if (totalPlayed > 0) {
      const highRatio = profile.highCardsPlayed / totalPlayed;
      if (highRatio < 0.2) strength += 20;
      if (highRatio > 0.5) strength -= 15;
    }

    strength -= profile.bombsPlayed * 15;

    if (profile.handCount <= 5 && profile.bombsPlayed === 0) {
      strength += 25;
    }

    if (profile.totalPlays > 3) {
      const passRate = profile.passCount / profile.totalPlays;
      if (passRate > 0.6) strength -= 10;
    }

    profile.estimatedStrength = Math.max(0, Math.min(100, strength));
  }
};

/**
 * Get threat level for a player
 * @param {string} playerId
 * @returns {number}
 */
GameMemory.prototype.getPlayerThreatLevel = function(playerId) {
  const profile = this.profiles.get(playerId);
  if (!profile || profile.handCount === 0) return 0;

  const handThreat = Math.max(0, 100 - profile.handCount * 5);
  return Math.round((handThreat * 0.6) + (profile.estimatedStrength * 0.4));
};

/**
 * Get most dangerous opponent
 * @param {number} myTeam
 * @returns {Object|null}
 */
GameMemory.prototype.getMostDangerousOpponent = function(myTeam) {
  let maxThreat = -1;
  let mostDangerous = null;

  for (const [id, profile] of this.profiles) {
    if (profile.team === myTeam || profile.handCount === 0) continue;
    const threat = this.getPlayerThreatLevel(id);
    if (threat > maxThreat) {
      maxThreat = threat;
      mostDangerous = profile;
    }
  }

  return mostDangerous;
};

/**
 * Get player profile
 * @param {string} playerId
 * @returns {Object|null}
 */
GameMemory.prototype.getProfile = function(playerId) {
  return this.profiles.get(playerId) || null;
};

/**
 * Count played cards of a rank
 * @param {string} rank
 * @returns {number}
 */
GameMemory.prototype.getPlayedCount = function(rank) {
  return this.allPlayedCards.filter(c => c.rank === rank).length;
};

/**
 * Get total cards remaining
 * @returns {number}
 */
GameMemory.prototype.getTotalCardsRemaining = function() {
  let total = 0;
  for (const [_, profile] of this.profiles) {
    total += profile.handCount;
  }
  return total;
};

/**
 * Get teammate minimum hand count
 * @param {string} myId
 * @param {number} myTeam
 * @param {Array} finishOrder
 * @returns {number}
 */
GameMemory.prototype.getTeammateMinHandCount = function(myId, myTeam, finishOrder) {
  let minCount = Infinity;
  for (const [id, profile] of this.profiles) {
    if (id === myId || profile.team !== myTeam || finishOrder.includes(id)) continue;
    minCount = Math.min(minCount, profile.handCount);
  }
  return minCount === Infinity ? 99 : minCount;
};

module.exports = GameMemory;
