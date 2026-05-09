// utils/ai/EndgameCalculator.js
// Precise hand estimation for endgame scenarios

function EndgameCalculator(ruleEngine) {
  this.ruleEngine = ruleEngine;
}

/**
 * Estimate opponent's possible hand
 * @param {number} handCount
 * @param {Array} playedCards
 * @param {Array} myHand
 * @param {Object} profile
 * @param {string} currentLevel
 * @returns {Object}
 */
EndgameCalculator.prototype.estimateOpponentHand = function(handCount, playedCards, myHand, profile, currentLevel) {
  const unseenRanks = this.getUnseenRanks(playedCards, myHand);

  if (handCount <= 5 && unseenRanks.size > 0) {
    return this.preciseEstimate(handCount, unseenRanks, profile, currentLevel);
  }

  return this.probabilisticEstimate(handCount, unseenRanks, profile, currentLevel);
};

/**
 * Precise estimate for endgame
 * @param {number} handCount
 * @param {Set} unseenRanks
 * @param {Object} profile
 * @param {string} currentLevel
 * @returns {Object}
 */
EndgameCalculator.prototype.preciseEstimate = function(handCount, unseenRanks, profile, currentLevel) {
  const possibleCombos = [];
  const remainingRanks = Array.from(unseenRanks);

  const hasPlayedBomb = profile.bombsPlayed > 0;
  const hasPlayedJoker = profile.bigJokersPlayed > 0 || profile.smallJokersPlayed > 0;
  const hasPlayedStraight = profile.straightsPlayed > 0;
  const hasPlayedFullHouse = profile.fullHousesPlayed > 0;

  if (handCount === 1) {
    possibleCombos.push({ type: 'Single', probability: 0.8 });
    if (!hasPlayedJoker) {
      possibleCombos.push({ type: 'Single-Joker', probability: 0.2 });
    }
  } else if (handCount === 2) {
    possibleCombos.push({ type: 'Pair', probability: 0.5 });
    possibleCombos.push({ type: 'TwoSingles', probability: 0.3 });
    possibleCombos.push({ type: 'Single-Joker', probability: 0.2 });
  } else if (handCount === 3) {
    possibleCombos.push({ type: 'Three', probability: 0.4 });
    possibleCombos.push({ type: 'Pair+Single', probability: 0.4 });
    possibleCombos.push({ type: 'ThreeSingles', probability: 0.2 });
  } else if (handCount === 5) {
    if (!hasPlayedStraight) {
      possibleCombos.push({ type: 'Straight', probability: 0.3 });
    }
    if (!hasPlayedFullHouse) {
      possibleCombos.push({ type: 'FullHouse', probability: 0.2 });
    }
    if (!hasPlayedBomb) {
      possibleCombos.push({ type: 'Bomb', probability: 0.2 });
    }
    possibleCombos.push({ type: 'FiveSingles', probability: 0.15 });
    possibleCombos.push({ type: 'Flush', probability: 0.1 });
  }

  let threatLevel = 'medium';
  if (!hasPlayedBomb && handCount === 5) {
    threatLevel = 'high';
  }
  if (!hasPlayedJoker && handCount <= 2) {
    threatLevel = 'high';
  }

  return {
    handCount,
    possibleCombos,
    threatLevel,
    canHaveBomb: !hasPlayedBomb,
    canHaveJoker: !hasPlayedJoker,
    likelyHasHighCard: remainingRanks.some(r => {
      const val = this.ruleEngine.getRankValue(r, currentLevel);
      return val >= 13;
    }),
  };
};

/**
 * Probabilistic estimate for mid-game
 * @param {number} handCount
 * @param {Set} unseenRanks
 * @param {Object} profile
 * @param {string} currentLevel
 * @returns {Object}
 */
EndgameCalculator.prototype.probabilisticEstimate = function(handCount, unseenRanks, profile, currentLevel) {
  const hasPlayedBomb = profile.bombsPlayed > 0;

  return {
    handCount,
    possibleCombos: [],
    threatLevel: 'unknown',
    canHaveBomb: !hasPlayedBomb && handCount >= 5,
    canHaveJoker: true,
    likelyHasHighCard: true,
  };
};

/**
 * Get unseen ranks
 * @param {Array} playedCards
 * @param {Array} myHand
 * @returns {Set}
 */
EndgameCalculator.prototype.getUnseenRanks = function(playedCards, myHand) {
  const totalPerRank = {
    '2': 12, '3': 12, '4': 12, '5': 12, '6': 12, '7': 12, '8': 12,
    '9': 12, '10': 12, 'J': 12, 'Q': 12, 'K': 12, 'A': 12,
    'Small': 3, 'Big': 3,
  };

  const seen = {};
  for (const card of playedCards) {
    seen[card.rank] = (seen[card.rank] || 0) + 1;
  }
  for (const card of myHand) {
    seen[card.rank] = (seen[card.rank] || 0) + 1;
  }

  const unseen = new Set();
  for (const rank of Object.keys(totalPerRank)) {
    const remaining = totalPerRank[rank] - (seen[rank] || 0);
    if (remaining > 0) {
      unseen.add(rank);
    }
  }

  return unseen;
};

/**
 * Determine if can beat opponent's estimated hand
 * @param {Array} myCards
 * @param {Object} opponentEstimate
 * @param {string} currentLevel
 * @returns {boolean}
 */
EndgameCalculator.prototype.canBeat = function(myCards, opponentEstimate, currentLevel) {
  if (opponentEstimate.threatLevel === 'low') {
    return true;
  }

  if (opponentEstimate.threatLevel === 'high') {
    if (opponentEstimate.canHaveBomb) {
      return false;
    }
  }

  return true;
};

module.exports = EndgameCalculator;
