// utils/ai/CardProbabilityEngine.js
// Card counting and probability calculations

const DECK_COUNT = 3;
const SUITS_PER_RANK = 4;
const TOTAL_PER_NORMAL_RANK = 12; // 4 * 3
const TOTAL_JOKERS = 3; // per type (Big/Small)
const TOTAL_CARDS = 162;

function CardProbabilityEngine(ruleEngine) {
  this.ruleEngine = ruleEngine;
  this.DECK_COUNT = DECK_COUNT;
  this.TOTAL_PER_NORMAL_RANK = TOTAL_PER_NORMAL_RANK;
  this.TOTAL_JOKERS = TOTAL_JOKERS;
  this.TOTAL_CARDS = TOTAL_CARDS;
}

/**
 * Get remaining count of a rank in unseen cards
 * @param {string} rank
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @returns {number}
 */
CardProbabilityEngine.prototype.getRemainingCount = function(rank, playedCards, ownHand) {
  const total = (rank === 'Big' || rank === 'Small')
    ? this.TOTAL_JOKERS
    : this.TOTAL_PER_NORMAL_RANK;

  const seen = [...playedCards, ...ownHand].filter(c => c.rank === rank).length;
  return Math.max(0, total - seen);
};

/**
 * Total remaining unseen cards
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @returns {number}
 */
CardProbabilityEngine.prototype.getTotalRemainingUnknown = function(playedCards, ownHand) {
  return Math.max(1, this.TOTAL_CARDS - playedCards.length - ownHand.length);
};

/**
 * Probability that opponent has a bomb of given rank
 * @param {string} rank
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @param {number} opponentHandCount
 * @param {string} currentLevel
 * @returns {number}
 */
CardProbabilityEngine.prototype.getBombProbability = function(
  rank, playedCards, ownHand, opponentHandCount, currentLevel
) {
  const remaining = this.getRemainingCount(rank, playedCards, ownHand);
  if (remaining < 3) return 0; // Not enough cards for a bomb

  const totalUnknown = this.getTotalRemainingUnknown(playedCards, ownHand);
  if (totalUnknown <= 0 || opponentHandCount <= 0) return 0;

  // Expected cards of this rank in opponent's hand
  const expected = opponentHandCount * (remaining / totalUnknown);

  // Map to probability using sigmoid: expected=5 -> ~0.99, expected=2.5 -> ~0.5
  const x = (expected - 2.5) * 2;
  const prob = 1 / (1 + Math.exp(-x));

  return Math.max(0, Math.min(1, prob));
};

/**
 * Probability that last play will be beaten by opponent
 * @param {number} lastPlayValue
 * @param {string} lastPlayType
 * @param {number} cardCount
 * @param {number} opponentHandCount
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @param {string} currentLevel
 * @returns {number}
 */
CardProbabilityEngine.prototype.getBeatenProbability = function(
  lastPlayValue, lastPlayType, cardCount, opponentHandCount, playedCards, ownHand, currentLevel
) {
  if (opponentHandCount <= 0) return 0;

  const totalUnknown = this.getTotalRemainingUnknown(playedCards, ownHand);
  if (totalUnknown <= 0) return 0;

  // Count stronger cards remaining
  let strongerCards = 0;

  if (lastPlayType === 'Bomb') {
    // Only bigger bombs can beat
    const bigRemaining = this.getRemainingCount('Big', playedCards, ownHand);
    const smallRemaining = this.getRemainingCount('Small', playedCards, ownHand);
    if (lastPlayValue < 99) {
      strongerCards += bigRemaining + smallRemaining;
    }
  } else if (cardCount === 1) {
    // Single: all higher singles
    const allRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'Small', 'Big'];
    for (const rank of allRanks) {
      const val = this.ruleEngine.getRankValue(rank, currentLevel);
      if (val > lastPlayValue) {
        strongerCards += this.getRemainingCount(rank, playedCards, ownHand);
      }
    }
  } else {
    // Multi-card: simplified estimation
    const allRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'Small', 'Big'];
    for (const rank of allRanks) {
      const val = this.ruleEngine.getRankValue(rank, currentLevel);
      if (val > lastPlayValue) {
        strongerCards += this.getRemainingCount(rank, playedCards, ownHand);
      }
    }
    // 5-card types need to form a complete combo, discount
    if (cardCount === 5) strongerCards = Math.floor(strongerCards * 0.2);
  }

  // Expected number of beating cards in opponent's hand
  const expected = opponentHandCount * (strongerCards / totalUnknown);

  // Map to probability: expected >= 2 -> likely to beat, expected < 0.5 -> unlikely
  const prob = Math.min(1, expected / 2.0);
  return Math.max(0, prob);
};

/**
 * Count remaining jokers (opponent's)
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @returns {number}
 */
CardProbabilityEngine.prototype.getRemainingJokerCount = function(playedCards, ownHand) {
  return this.getRemainingCount('Big', playedCards, ownHand) +
         this.getRemainingCount('Small', playedCards, ownHand);
};

/**
 * Probability that opponent has at least 1 joker
 * @param {string} rank - 'Big' or 'Small'
 * @param {Array} playedCards
 * @param {Array} ownHand
 * @param {number} opponentHandCount
 * @returns {number}
 */
CardProbabilityEngine.prototype.getJokerInHandProbability = function(
  rank, playedCards, ownHand, opponentHandCount
) {
  const remaining = this.getRemainingCount(rank, playedCards, ownHand);
  if (remaining <= 0 || opponentHandCount <= 0) return 0;

  const totalUnknown = this.getTotalRemainingUnknown(playedCards, ownHand);
  if (totalUnknown <= 0) return 0;

  // P(at least 1) = 1 - P(none)
  const pNone = Math.pow(1 - remaining / totalUnknown, opponentHandCount);
  return Math.max(0, Math.min(1, 1 - pNone));
};

/**
 * Extract all played cards from history
 * @param {Array} history
 * @returns {Array}
 */
CardProbabilityEngine.extractPlayedCards = function(history) {
  const result = [];
  for (const action of history) {
    if (action.cards) {
      for (const card of action.cards) {
        result.push(card);
      }
    }
  }
  return result;
};

module.exports = CardProbabilityEngine;
