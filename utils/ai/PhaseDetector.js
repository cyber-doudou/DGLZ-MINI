// utils/ai/PhaseDetector.js
// Detects game phase and provides phase-specific weights

/**
 * Game phases
 * @type {Object}
 */
const PHASE_CONFIGS = {
  Opening: {
    trashClearBonus: 40,
    pairBonus: 15,
    fiveCardBonus: 25,
    jokerPenalty: -80,
    levelCardPenalty: -60,
    passForTeammateBonus: 200,
    toppingTeammatePenalty: -300,
    blockBonus: 30,
    allowBombSacrifice: false,
    efficiencyBonus: 20,
    controlBonus: 10,
  },
  MidGame: {
    trashClearBonus: 20,
    pairBonus: 20,
    fiveCardBonus: 40,
    jokerPenalty: -50,
    levelCardPenalty: -40,
    passForTeammateBonus: 250,
    toppingTeammatePenalty: -350,
    blockBonus: 80,
    allowBombSacrifice: false,
    efficiencyBonus: 30,
    controlBonus: 25,
  },
  Endgame: {
    trashClearBonus: 5,
    pairBonus: 10,
    fiveCardBonus: 50,
    jokerPenalty: -10,
    levelCardPenalty: -10,
    passForTeammateBonus: 300,
    toppingTeammatePenalty: -400,
    blockBonus: 150,
    allowBombSacrifice: true,
    efficiencyBonus: 50,
    controlBonus: 40,
  },
  Emergency: {
    trashClearBonus: 0,
    pairBonus: 5,
    fiveCardBonus: 30,
    jokerPenalty: 0,
    levelCardPenalty: 0,
    passForTeammateBonus: 100,
    toppingTeammatePenalty: -100,
    blockBonus: 300,
    allowBombSacrifice: true,
    efficiencyBonus: 20,
    controlBonus: 60,
  },
  Coasting: {
    trashClearBonus: 30,
    pairBonus: 10,
    fiveCardBonus: 15,
    jokerPenalty: -100,
    levelCardPenalty: -80,
    passForTeammateBonus: 500,
    toppingTeammatePenalty: -600,
    blockBonus: 50,
    allowBombSacrifice: false,
    efficiencyBonus: 10,
    controlBonus: 5,
  },
};

/**
 * PhaseDetector class
 */
function PhaseDetector() {
  // No-op for miniprogram (no file I/O for overrides)
}

/**
 * Detect the current game phase
 * @param {Array} myHand
 * @param {Object} gameState
 * @param {string} playerId
 * @param {Object} memory - GameMemory instance
 * @returns {{phase: string, weights: Object, reason: string}}
 */
PhaseDetector.prototype.detect = function(myHand, gameState, playerId, memory) {
  const players = gameState.players;
  const me = players.find(p => p.id === playerId);
  const myTeam = me ? me.team : 0;
  const myHandCount = myHand.length;
  const finishOrder = gameState.finishOrder || [];

  // 1. Check EMERGENCY: Any opponent near finishing
  const opponents = players.filter(p =>
    p.team !== myTeam && !finishOrder.includes(p.id)
  );
  const opponentHands = opponents.map(p => p.handCount).filter(h => h > 0);
  const minOpponentHand = opponentHands.length > 0 ? Math.min(...opponentHands) : 999;

  if (minOpponentHand <= 5 && minOpponentHand > 0) {
    return {
      phase: 'Emergency',
      weights: { ...PHASE_CONFIGS.Emergency },
      reason: `对手仅剩 ${minOpponentHand} 张牌，启动紧急封锁模式`,
    };
  }

  // 2. Check COASTING: Teammate is about to finish
  const teammates = players.filter(p =>
    p.team === myTeam && p.id !== playerId && !finishOrder.includes(p.id)
  );
  const teammateHands = teammates.map(p => p.handCount).filter(h => h > 0);
  const minTeammateHand = teammateHands.length > 0 ? Math.min(...teammateHands) : 999;
  const teammatesFinished = finishOrder.filter(id => {
    const p = players.find(pp => pp.id === id);
    return p && p.team === myTeam;
  }).length;

  if (minTeammateHand <= 3 || teammatesFinished >= 1) {
    return {
      phase: 'Coasting',
      weights: { ...PHASE_CONFIGS.Coasting },
      reason: teammatesFinished >= 1
        ? `队友已出完 ${teammatesFinished} 人，让路保守模式`
        : `队友仅剩 ${minTeammateHand} 张牌，进入让路模式`,
    };
  }

  // 3. Standard phases based on own hand count
  if (myHandCount <= 10) {
    return {
      phase: 'Endgame',
      weights: { ...PHASE_CONFIGS.Endgame },
      reason: `手牌仅剩 ${myHandCount} 张，进入残局冲刺`,
    };
  }

  if (myHandCount <= 20) {
    return {
      phase: 'MidGame',
      weights: { ...PHASE_CONFIGS.MidGame },
      reason: `手牌 ${myHandCount} 张，中盘攻防阶段`,
    };
  }

  return {
    phase: 'Opening',
    weights: { ...PHASE_CONFIGS.Opening },
    reason: `手牌 ${myHandCount} 张，开局消耗阶段`,
  };
};

/**
 * Get phase config
 * @param {string} phase
 * @returns {Object}
 */
PhaseDetector.prototype.getPhaseConfig = function(phase) {
  return PHASE_CONFIGS[phase] || PHASE_CONFIGS.Opening;
};

module.exports = PhaseDetector;
module.exports.PHASE_CONFIGS = PHASE_CONFIGS;
