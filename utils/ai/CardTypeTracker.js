// utils/ai/CardTypeTracker.js
// Tracks each player's card types for opponent modeling

function CardTypeTracker(ruleEngine) {
  this.ruleEngine = ruleEngine;
  this.playerRecords = new Map();
}

/**
 * Reset all records
 */
CardTypeTracker.prototype.reset = function() {
  this.playerRecords.clear();
};

/**
 * Initialize players
 * @param {Array} players - [{id, team}]
 */
CardTypeTracker.prototype.initPlayers = function(players) {
  for (const p of players) {
    if (!this.playerRecords.has(p.id)) {
      this.playerRecords.set(p.id, {
        playerId: p.id,
        team: p.team,
        singlesPlayed: 0,
        pairsPlayed: 0,
        threesPlayed: 0,
        straightsPlayed: 0,
        flushesPlayed: 0,
        fullHousesPlayed: 0,
        fourWithOnesPlayed: 0,
        straightFlushesPlayed: 0,
        bombsPlayed: 0,
        bigJokersPlayed: 0,
        smallJokersPlayed: 0,
        levelCardsPlayed: 0,
        wildcardsUsedInStraights: 0,
        highCardsPlayed: 0,
        lowCardsPlayed: 0,
        totalCardsPlayed: 0,
        lastPlayType: null,
        consecutivePasses: 0,
      });
    }
  }
};

/**
 * Update records from history
 * @param {Array} history
 * @param {string} currentLevel
 * @param {Array} players
 */
CardTypeTracker.prototype.updateFromHistory = function(history, currentLevel, players) {
  this.initPlayers(players);

  for (const action of history) {
    const record = this.playerRecords.get(action.playerId);
    if (!record) continue;

    if (action.cards.length === 0) {
      record.consecutivePasses++;
      continue;
    }

    record.consecutivePasses = 0;
    record.totalCardsPlayed += action.cards.length;
    record.lastPlayType = action.playType;

    // Count card types
    switch (action.playType) {
      case 'Single': record.singlesPlayed++; break;
      case 'Pair': record.pairsPlayed++; break;
      case 'Three': record.threesPlayed++; break;
      case 'Straight': record.straightsPlayed++; break;
      case 'Flush': record.flushesPlayed++; break;
      case 'FullHouse': record.fullHousesPlayed++; break;
      case 'FourWithOne': record.fourWithOnesPlayed++; break;
      case 'StraightFlush': record.straightFlushesPlayed++; break;
      case 'Bomb': record.bombsPlayed++; break;
    }

    // Count specific cards
    for (const card of action.cards) {
      if (card.rank === 'Big') record.bigJokersPlayed++;
      if (card.rank === 'Small') record.smallJokersPlayed++;
      if (card.rank === currentLevel) record.levelCardsPlayed++;

      const value = this.ruleEngine.getRankValue(card.rank, currentLevel);
      if (value >= 13) record.highCardsPlayed++;
      if (value < 10) record.lowCardsPlayed++;
    }
  }
};

/**
 * Infer player characteristics from their play history
 * @param {string} playerId
 * @returns {Object}
 */
CardTypeTracker.prototype.inferPlayer特征 = function(playerId) {
  const record = this.playerRecords.get(playerId);
  if (!record) {
    return {
      hasBomb: false,
      hasControlCards: false,
      handIsWeak: false,
      likelyHasFullHouse: false,
      likelyHasStraight: false,
      likelyHasFlush: false,
      threatLevel: 'unknown',
    };
  }

  const result = {
    hasBomb: record.bombsPlayed > 0,
    hasControlCards: record.bigJokersPlayed > 0 || record.smallJokersPlayed > 0,
    handIsWeak: false,
    likelyHasFullHouse: false,
    likelyHasStraight: false,
    likelyHasFlush: false,
    threatLevel: 'unknown',
  };

  // 1. Many singles but no control cards -> weak hand
  if (record.singlesPlayed >= 3 && record.bigJokersPlayed === 0 && record.smallJokersPlayed === 0) {
    result.handIsWeak = true;
  }

  // 2. Played full house -> unlikely to have bomb
  if (record.fullHousesPlayed > 0) {
    result.likelyHasFullHouse = true;
  }

  // 3. Played straight -> may have singles/pairs left
  if (record.straightsPlayed > 0) {
    result.likelyHasStraight = true;
  }

  // 4. Played flush -> has suited cards
  if (record.flushesPlayed > 0) {
    result.likelyHasFlush = true;
  }

  // 5. Threat level assessment
  if (record.bombsPlayed > 0) {
    result.threatLevel = 'medium';
  }
  if (record.bigJokersPlayed > 0) {
    result.threatLevel = 'high';
  }
  if (record.fullHousesPlayed > 0 && record.straightsPlayed > 0) {
    result.threatLevel = 'high';
  }

  return result;
};

/**
 * Get player's record
 * @param {string} playerId
 * @returns {Object|null}
 */
CardTypeTracker.prototype.getRecord = function(playerId) {
  return this.playerRecords.get(playerId) || null;
};

/**
 * Get all player characteristics
 * @returns {Map}
 */
CardTypeTracker.prototype.getAllPlayer特征 = function() {
  const result = new Map();
  for (const [id] of this.playerRecords) {
    result.set(id, this.inferPlayer特征(id));
  }
  return result;
};

module.exports = CardTypeTracker;
