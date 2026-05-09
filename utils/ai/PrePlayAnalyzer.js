// utils/ai/PrePlayAnalyzer.js
// Pre-play self-assessment for strategy decisions

const HandAnalyzer = require('./HandAnalyzer.js');

/**
 * @typedef {'attack' | 'support' | 'defend'} StrategyMode
 * @typedef {'strong' | 'medium' | 'weak'} HandStrength
 */

function PrePlayAnalyzer(ruleEngine) {
  this.ruleEngine = ruleEngine;
  this.handAnalyzer = new HandAnalyzer(ruleEngine);
}

/**
 * Analyze hand and determine strategy
 * @param {Array} hand
 * @param {Object} gameState
 * @param {string} myPlayerId
 * @returns {Object}
 */
PrePlayAnalyzer.prototype.analyze = function(hand, gameState, myPlayerId) {
  const { currentLevel, lastPlay, players, finishOrder } = gameState;
  const myProfile = players.find(p => p.id === myPlayerId);
  const myTeam = myProfile ? myProfile.team : 0;

  // 1. Analyze hand structure
  const structure = this.handAnalyzer.decompose(hand, currentLevel);
  const myHandCount = hand.length;

  // 2. Evaluate strength
  const strength = this.evaluateStrength(hand, structure, currentLevel);

  // 3. Evaluate situation
  const situation = this.evaluateSituation(players, myPlayerId, myTeam, lastPlay, finishOrder);

  // 4. Decide strategy
  const strategy = this.decideStrategy(strength, situation, lastPlay, myTeam, players);

  // 5. Find best combo
  const bestCombo = this.findBestCombo(structure, strategy);

  return {
    myStrength: strength.level,
    strategyMode: strategy.mode,
    controlCards: strength.controlCards,
    bombs: strength.bombs,
    bestCombo: bestCombo,
    estimatedTurns: structure.turnsToEmpty,
    reasoning: strategy.reasoning,
  };
};

/**
 * Evaluate hand strength
 * @param {Array} hand
 * @param {Object} structure
 * @param {string} currentLevel
 * @returns {Object}
 */
PrePlayAnalyzer.prototype.evaluateStrength = function(hand, structure, currentLevel) {
  let controlCards = 0;
  let bombs = 0;

  // Count control cards
  for (const card of hand) {
    if (card.rank === 'Big') controlCards += 3;
    else if (card.rank === 'Small') controlCards += 2;
    else if (card.rank === currentLevel) controlCards += 1;
  }

  // Count bombs
  for (const group of structure.groups) {
    if (group.type === 'Bomb') bombs++;
  }

  // Score
  let score = controlCards + bombs * 5;

  let level;
  if (score >= 10) level = 'strong';
  else if (score >= 5) level = 'medium';
  else level = 'weak';

  return { level: level, score: score, controlCards: controlCards, bombs: bombs };
};

/**
 * Evaluate game situation
 * @param {Array} players
 * @param {string} myPlayerId
 * @param {number} myTeam
 * @param {Object} lastPlay
 * @param {Array} finishOrder
 * @returns {Object}
 */
PrePlayAnalyzer.prototype.evaluateSituation = function(players, myPlayerId, myTeam, lastPlay, finishOrder) {
  const activePlayers = players.filter(p => !finishOrder.includes(p.id));
  const teammatesInPlay = activePlayers.filter(p => p.team === myTeam && p.id !== myPlayerId).length;
  const opponentsInPlay = activePlayers.filter(p => p.team !== myTeam).length;

  const myIndex = players.findIndex(p => p.id === myPlayerId);
  let myPosition = 'middle';
  if (myIndex <= 1 || myIndex >= 5) myPosition = 'early';
  if (myIndex === 3 || myIndex === 4) myPosition = 'late';

  let isWinningTrick = false;
  if (lastPlay && lastPlay.cards && lastPlay.cards.length > 0) {
    const lastPlayer = players.find(p => p.id === lastPlay.playerId);
    if (lastPlayer && lastPlayer.team === myTeam) {
      isWinningTrick = true;
    }
  }

  const dangerousOpponents = players.filter(
    p => p.team !== myTeam && !finishOrder.includes(p.id) && p.handCount <= 5
  ).length;

  return {
    teammatesInPlay,
    opponentsInPlay,
    myPosition,
    isWinningTrick,
    dangerousOpponents,
  };
};

/**
 * Decide strategy
 * @param {Object} strength
 * @param {Object} situation
 * @param {Object} lastPlay
 * @param {number} myTeam
 * @param {Array} players
 * @returns {Object}
 */
PrePlayAnalyzer.prototype.decideStrategy = function(strength, situation, lastPlay, myTeam, players) {
  const reasons = [];

  // Check if teammate is winning
  let teammateWinning = false;
  if (lastPlay && lastPlay.cards && lastPlay.cards.length > 0) {
    const lastPlayer = players.find(p => p.id === lastPlay.playerId);
    if (lastPlayer && lastPlayer.team === myTeam) {
      teammateWinning = true;
    }
  }

  // Case 1: Teammate is winning
  if (teammateWinning) {
    if (strength.level === 'strong') {
      reasons.push('队友在赢+手牌强，可以进攻或配合');
      return { mode: 'attack', reasoning: reasons.join('; ') };
    } else if (strength.level === 'medium') {
      reasons.push('队友在赢+手牌中，帮助配合');
      return { mode: 'support', reasoning: reasons.join('; ') };
    } else {
      reasons.push('队友在赢+手牌弱，让路给队友');
      return { mode: 'support', reasoning: reasons.join('; ') };
    }
  }

  // Case 2: Opponent is winning
  if (!teammateWinning && lastPlay && lastPlay.cards && lastPlay.cards.length > 0) {
    if (strength.level === 'strong') {
      reasons.push('对手在赢+手牌强，夺权抢头');
      return { mode: 'attack', reasoning: reasons.join('; ') };
    } else if (strength.level === 'medium') {
      if (situation.dangerousOpponents > 0) {
        reasons.push('对手在赢+手牌中+有危险对手，防守');
        return { mode: 'defend', reasoning: reasons.join('; ') };
      } else {
        reasons.push('对手在赢+手牌中，观察等待');
        return { mode: 'support', reasoning: reasons.join('; ') };
      }
    } else {
      reasons.push('对手在赢+手牌弱，避免被关');
      return { mode: 'defend', reasoning: reasons.join('; ') };
    }
  }

  // Case 3: Leading or no previous play
  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
    if (strength.level === 'strong') {
      reasons.push('首发+手牌强，争取主动');
      return { mode: 'attack', reasoning: reasons.join('; ') };
    } else if (strength.level === 'medium') {
      reasons.push('首发+手牌中，稳健出牌');
      return { mode: 'support', reasoning: reasons.join('; ') };
    } else {
      reasons.push('首发+手牌弱，保守开局');
      return { mode: 'defend', reasoning: reasons.join('; ') };
    }
  }

  // Default
  reasons.push('默认进攻策略');
  return { mode: 'attack', reasoning: reasons.join('; ') };
};

/**
 * Find best combo based on strategy
 * @param {Object} structure
 * @param {Object} strategy
 * @returns {string}
 */
PrePlayAnalyzer.prototype.findBestCombo = function(structure, strategy) {
  if (!structure.groups || structure.groups.length === 0) return '无';

  if (strategy.mode === 'attack') {
    const fiveCard = structure.groups.find(g =>
      ['Bomb', 'StraightFlush', 'FourWithOne', 'FullHouse', 'Straight', 'Flush'].includes(g.type)
    );
    if (fiveCard) return fiveCard.type;

    const three = structure.groups.find(g => g.type === 'Three');
    if (three) return 'Three';

    const pair = structure.groups.find(g => g.type === 'Pair');
    if (pair) return 'Pair';

    return 'Single';
  } else if (strategy.mode === 'support') {
    const pairs = structure.groups.filter(g => g.type === 'Pair');
    if (pairs.length > 0) return 'Pair';
    return 'Single';
  } else {
    const singles = structure.groups.filter(g => g.type === 'Single');
    if (singles.length > 0) {
      const lowest = singles.reduce((min, g) => g.value < min.value ? g : min);
      return `Single(${lowest.cards[0].rank})`;
    }
    return 'Single';
  }
};

module.exports = PrePlayAnalyzer;
