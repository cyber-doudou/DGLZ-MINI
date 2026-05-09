// utils/ai/StrategicPlanner.js
// Core AI decision engine with forward-looking scoring

const HandAnalyzer = require('./HandAnalyzer.js');
const GameMemory = require('./GameMemory.js');
const PhaseDetector = require('./PhaseDetector.js');
const CardProbabilityEngine = require('./CardProbabilityEngine.js');
const PrePlayAnalyzer = require('./PrePlayAnalyzer.js');
const EndgameCalculator = require('./EndgameCalculator.js');

// Default scoring weights (embedded from StrategicPlanner.ts)
const DEFAULT_SCORING_WEIGHTS = {
  // LEADING
  sizeBonusPerCard: 30,
  valuePenaltyMultiplier: 4,
  trashClearBonus: 40,
  fiveCardBonus: 25,

  // PENALTIES
  bigJokerLeadPenalty: -300,
  smallJokerLeadPenalty: -150,
  levelSinglePenalty: -200,
  bigJokerInFiveCardPenalty: -300,
  smallJokerInFiveCardPenalty: -150,
  levelCardInFiveCardPenalty: -60,
  bigJokerFollowPenalty: -400,
  smallJokerFollowPenalty: -150,
  jokerInFiveCardFollowPenalty: -80,
  levelCardInFiveCardFollowPenalty: -50,
  bigJokerInFiveCardExtraPenalty: -220,
  smallJokerInFiveCardExtraPenalty: -70,
  levelCardInFiveCardExtraPenalty: -50,
  bombFollowPenalty: -400,
  bigJokerSingleFollowPenalty: -400,
  smallJokerSingleFollowPenalty: -150,

  // STRANDED
  bigJokerStrandedPenalty: -80,
  smallJokerStrandedPenalty: -60,
  levelStrandedPenalty: -40,

  // PASS
  passForTeammateBonus: 200,
  passWhenOpponentWinningPenalty: -20,
  passEmergencyPenalty: -150,
  passOpponentCantBeatBonus: 30,

  // BLOCKING
  blockBonus: 100,
  blockUrgencyMultiplier: 20,

  // FINISHING
  finishBonus: 1000,
  proximityBonusPerTurn: 100,

  // STRATEGY
  controlCardAgainstThreatBonus: 30,
  controlCardProtectionPenalty: -50,
  supportHighCardPenalty: -30,
  attackControlCardBonus: 20,

  // OPPONENT MODELING
  opponentNoBombRecordPenalty: -30,
  opponentWeakBonus: 20,
  opponentNoFiveCardTypePenalty: -40,

  // ENDGAME
  endgameBombRiskPenalty: -50,
  endgameJokerRiskPenalty: -30,
  endgameHighThreatPenalty: -20,

  // BOMB RISK
  bombRiskPenaltyMultiplier: 80,

  // EFFICIENCY
  efficiencyBonus: 50,
};

/**
 * StrategicPlanner: Core AI decision engine
 * For each legal candidate move, it:
 * 1. Simulates playing those cards
 * 2. Re-decomposes the remaining hand
 * 3. Scores based on phase weights + future hand quality + team situation
 */
function StrategicPlanner(ruleEngine, silent) {
  this.ruleEngine = ruleEngine;
  this.handAnalyzer = new HandAnalyzer(ruleEngine);
  this.phaseDetector = new PhaseDetector();
  this.memory = new GameMemory(ruleEngine);
  this.probEngine = new CardProbabilityEngine(ruleEngine);
  this.prePlayAnalyzer = new PrePlayAnalyzer(ruleEngine);
  this.endgameCalculator = new EndgameCalculator(ruleEngine);
  this.silent = silent || false;
  this.weights = { ...DEFAULT_SCORING_WEIGHTS };
  this._lastPhase = 'Opening';
  this._lastPhaseReason = '';
}

StrategicPlanner.prototype.setWeights = function(w) {
  this.weights = { ...this.weights, ...w };
};

StrategicPlanner.prototype.getWeights = function() {
  return this.weights;
};

StrategicPlanner.prototype.getMemory = function() {
  return this.memory;
};

StrategicPlanner.prototype.getCurrentPhase = function() {
  return { phase: this._lastPhase, reason: this._lastPhaseReason };
};

/**
 * Main entry point: Select the best play
 * @param {Array} hand
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {Object} - {type, cards, score, reasoning}
 */
StrategicPlanner.prototype.selectPlay = function(hand, gameState, playerId) {
  const currentLevel = gameState.currentLevel;
  const lastPlay = gameState.lastPlay;
  const players = gameState.players;
  const me = players.find(p => p.id === playerId);
  const myTeam = me ? me.team : 0;

  // Update memory from history
  this.memory.updateFromHistory(
    gameState.history || [],
    currentLevel,
    players.map(p => ({ id: p.id, team: p.team, handCount: p.handCount }))
  );

  // Detect game phase
  const { phase, weights, reason: phaseReason } = this.phaseDetector.detect(
    hand, gameState, playerId, this.memory
  );
  this._lastPhase = phase;
  this._lastPhaseReason = phaseReason;

  // Analyze current hand structure
  const currentStructure = this.handAnalyzer.decompose(hand, currentLevel);

  // Pre-play analysis
  const preAnalysis = this.prePlayAnalyzer.analyze(hand, gameState, playerId);

  // Generate legal candidates
  const legalCandidates = this.ruleEngine.findLegalChoices(hand, gameState, playerId, {});

  // Score each candidate
  const scored = legalCandidates.map(candidate => {
    const { score, reasoning } = this.scoreWithForwardLooking(
      candidate, hand, currentStructure, gameState, playerId, myTeam, phase, weights, currentLevel, preAnalysis
    );
    return {
      type: candidate.type,
      cards: candidate.cards,
      score: score,
      reasoning: reasoning,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0] || { type: 'Pass', cards: [], score: 0, reasoning: 'No legal moves' };

  if (!this.silent) {
    console.log(`[AI] ${me?.name || playerId} | Phase=${phase} | Decision: ${best.type} (Score: ${best.score.toFixed(0)})`);
  }

  return best;
};

/**
 * Score a candidate move with forward-looking analysis
 */
StrategicPlanner.prototype.scoreWithForwardLooking = function(
  candidate, hand, currentStructure, gameState, playerId, myTeam, phase, weights, currentLevel, preAnalysis
) {
  const lastPlay = gameState.lastPlay;
  const players = gameState.players;
  const finishOrder = gameState.finishOrder || [];
  const reasons = [];
  let totalScore = 0;

  // === PASS SCORING ===
  if (candidate.type === 'Pass') {
    if (lastPlay && lastPlay.cards.length > 0) {
      const lastPlayer = players.find(p => p.id === lastPlay.playerId);
      if (lastPlayer && lastPlayer.team === myTeam) {
        totalScore += weights.passForTeammateBonus;
        reasons.push(`队友在赢+${weights.passForTeammateBonus}`);
      } else {
        const basePassPenalty = phase === 'Emergency'
          ? this.weights.passEmergencyPenalty
          : this.weights.passWhenOpponentWinningPenalty;
        totalScore += basePassPenalty;
        reasons.push(`对手在赢,Pass${phase === 'Emergency' ? '紧急' : ''}不利${basePassPenalty}`);

        if (phase !== 'Emergency') {
          const playedCards = CardProbabilityEngine.extractPlayedCards(gameState.history || []);
          const lastPlayValue = lastPlay.cards.length > 0
            ? Math.max(...lastPlay.cards.map(c => this.ruleEngine.getRankValue(c.rank, currentLevel)))
            : 0;
          const lastPlayType = lastPlay.playType || 'Unknown';
          const nextOpponent = players.find(p =>
            p.team !== myTeam && !finishOrder.includes(p.id) && p.id !== lastPlay.playerId
          );
          if (nextOpponent) {
            const beatProb = this.probEngine.getBeatenProbability(
              lastPlayValue, lastPlayType, lastPlay.cards.length,
              nextOpponent.handCount, playedCards, hand, currentLevel
            );
            if (beatProb < 0.25) {
              totalScore += this.weights.passOpponentCantBeatBonus;
              reasons.push(`对手管不上(P=${beatProb.toFixed(2)})+${this.weights.passOpponentCantBeatBonus}`);
            }
          }
        }
      }
    }
    return { score: totalScore, reasoning: reasons.join('; ') || 'Pass' };
  }

  // === PLAY SCORING ===
  const playedValues = candidate.cards.map(c => this.ruleEngine.getRankValue(c.rank, currentLevel));
  const avgPlayedValue = playedValues.reduce((a, b) => a + b, 0) / playedValues.length;
  const maxPlayedValue = Math.max(...playedValues);
  const cardCount = candidate.cards.length;
  const isLeading = !lastPlay || lastPlay.cards.length === 0;
  const playType = this.ruleEngine.getPlayType(candidate.cards, currentLevel) || candidate.type;

  // Forward-Looking: re-decompose remaining hand
  const futureStructure = this.handAnalyzer.evaluateAfterPlay(hand, candidate.cards, currentLevel);
  const turnsDelta = futureStructure.turnsToEmpty - currentStructure.turnsToEmpty;
  const efficiencyScore = (-1 - turnsDelta) * this.weights.efficiencyBonus;
  totalScore += efficiencyScore;
  if (turnsDelta > 0) {
    reasons.push(`拆牌+${turnsDelta}轮-${(turnsDelta * this.weights.efficiencyBonus).toFixed(0)}`);
  }

  // === Core priority ordering ===
  if (isLeading) {
    const isBomb = playType === 'Bomb';
    const isJokerSingle = cardCount === 1 && (candidate.cards[0].rank === 'Big' || candidate.cards[0].rank === 'Small');
    const isLevelSingle = cardCount === 1 && candidate.cards[0].rank === currentLevel;

    if (isBomb) {
      const bombTypeBonus = phase === 'Emergency' ? 200 : this.weights.bombFollowPenalty;
      totalScore += bombTypeBonus;
      reasons.push(bombTypeBonus > 0 ? `炸弹封锁+${bombTypeBonus}` : `炸弹领先浪费${bombTypeBonus}`);
    } else if (isJokerSingle) {
      const jokerPenalty = candidate.cards[0].rank === 'Big'
        ? this.weights.bigJokerLeadPenalty
        : this.weights.smallJokerLeadPenalty;
      totalScore += jokerPenalty;
      reasons.push(`怪牌保留${jokerPenalty}`);
    } else if (isLevelSingle) {
      totalScore += this.weights.levelSinglePenalty;
      reasons.push(`级牌保留${this.weights.levelSinglePenalty}`);
    } else {
      const sizBonus = cardCount * this.weights.sizeBonusPerCard;
      const valPenalty = avgPlayedValue * this.weights.valuePenaltyMultiplier;
      totalScore += sizBonus - valPenalty;
      reasons.push(`主动+${(sizBonus - valPenalty).toFixed(0)}(${cardCount}张,均值${avgPlayedValue.toFixed(0)})`);
    }

    // Trash clear bonus
    if (cardCount === 1 && avgPlayedValue < 10 && !isLevelSingle && !isJokerSingle) {
      totalScore += this.weights.trashClearBonus;
      reasons.push(`清垃圾+${this.weights.trashClearBonus}`);
    }

    // 5-card bonus
    if (cardCount === 5 && !isBomb) {
      totalScore += this.weights.fiveCardBonus;
      const typeRank = { 'StraightFlush': 50, 'FourWithOne': 40, 'FullHouse': 30, 'Straight': 20, 'Flush': 20 };
      const typeBonus = typeRank[playType] || 10;
      totalScore += typeBonus;
      reasons.push(`五张牌型+${typeBonus}(${playType})`);

      // Joker penalties
      const bigJokersUsed = candidate.cards.filter(c => c.rank === 'Big').length;
      const smallJokersUsed = candidate.cards.filter(c => c.rank === 'Small').length;
      const levelCardsUsed = candidate.cards.filter(c => c.rank === currentLevel).length;

      if (bigJokersUsed > 0) {
        totalScore += bigJokersUsed * this.weights.bigJokerInFiveCardPenalty;
        reasons.push(`五张用大王x${bigJokersUsed}${this.weights.bigJokerInFiveCardPenalty}`);
      }
      if (smallJokersUsed > 0) {
        totalScore += smallJokersUsed * this.weights.smallJokerInFiveCardPenalty;
        reasons.push(`五张用小王x${smallJokersUsed}${this.weights.smallJokerInFiveCardPenalty}`);
      }
      if (levelCardsUsed > 0) {
        totalScore += levelCardsUsed * this.weights.levelCardInFiveCardPenalty;
        reasons.push(`五张用级牌x${levelCardsUsed}${this.weights.levelCardInFiveCardPenalty}`);
      }
    }
  } else {
    // FOLLOWING
    totalScore += Math.max(0, (15 - avgPlayedValue)) * 4;
    reasons.push(`跟牌省资源+${Math.max(0, (15 - avgPlayedValue) * 4).toFixed(0)}`);

    if (playType === 'Bomb') {
      const bombPenalty = weights.allowBombSacrifice ? 0 : this.weights.bombFollowPenalty;
      totalScore += bombPenalty;
      reasons.push(`跟牌用炸弹${bombPenalty}`);
    }

    const isBigJokerSingle = cardCount === 1 && candidate.cards[0].rank === 'Big';
    const isSmallJokerSingle = cardCount === 1 && candidate.cards[0].rank === 'Small';
    if (isBigJokerSingle) {
      totalScore += this.weights.bigJokerSingleFollowPenalty;
      reasons.push(`大王跟普通牌${this.weights.bigJokerSingleFollowPenalty}`);
    } else if (isSmallJokerSingle) {
      totalScore += this.weights.smallJokerSingleFollowPenalty;
      reasons.push(`小王跟普通牌${this.weights.smallJokerSingleFollowPenalty}`);
    }

    const jokersUsed = candidate.cards.filter(c => c.rank === 'Big' || c.rank === 'Small').length;
    if (jokersUsed > 0) {
      totalScore += jokersUsed * this.weights.jokerInFiveCardFollowPenalty;
      reasons.push(`五张用怪x${jokersUsed}${this.weights.jokerInFiveCardFollowPenalty}`);
    }
    const levelCardsUsed = candidate.cards.filter(c => c.rank === currentLevel).length;
    if (levelCardsUsed > 0) {
      totalScore += levelCardsUsed * this.weights.levelCardInFiveCardFollowPenalty;
      reasons.push(`跟牌用级牌x${levelCardsUsed}${this.weights.levelCardInFiveCardFollowPenalty}`);
    }

    if (cardCount === 5) {
      totalScore += this.weights.fiveCardBonus;
      const bigJokersUsed = candidate.cards.filter(c => c.rank === 'Big').length;
      const smallJokersUsed = candidate.cards.filter(c => c.rank === 'Small').length;
      if (bigJokersUsed > 0) {
        totalScore += bigJokersUsed * this.weights.bigJokerInFiveCardExtraPenalty;
        reasons.push(`五张用大王x${bigJokersUsed}额外${this.weights.bigJokerInFiveCardExtraPenalty}`);
      }
      if (smallJokersUsed > 0) {
        totalScore += smallJokersUsed * this.weights.smallJokerInFiveCardExtraPenalty;
        reasons.push(`五张用小王x${smallJokersUsed}额外${this.weights.smallJokerInFiveCardExtraPenalty}`);
      }
    }
  }

  // Team situation
  if (lastPlay && lastPlay.cards.length > 0) {
    const lastPlayer = players.find(p => p.id === lastPlay.playerId);
    if (lastPlayer && lastPlayer.team === myTeam) {
      totalScore += weights.toppingTeammatePenalty;
      reasons.push(`压队友${weights.toppingTeammatePenalty}`);
    }
  }

  // Opponent blocking
  const opponents = players.filter(p =>
    p.team !== myTeam && !finishOrder.includes(p.id) && p.handCount > 0
  );
  const minOpponentHand = opponents.length > 0
    ? Math.min(...opponents.map(p => p.handCount))
    : 99;

  if (minOpponentHand <= 10) {
    const urgency = Math.max(0, 11 - minOpponentHand);
    if (maxPlayedValue >= 13 || ['Bomb', 'StraightFlush', 'FourWithOne'].includes(playType)) {
      const blockScore = urgency * (this.weights.blockUrgencyMultiplier);
      totalScore += blockScore;
      reasons.push(`封锁紧迫${urgency}+${blockScore.toFixed(0)}`);
    }

    // Bomb risk
    if (playType === 'Bomb' && opponents.length > 0) {
      const playedCards = CardProbabilityEngine.extractPlayedCards(gameState.history || []);
      const dangerousOpponent = opponents.reduce((prev, cur) => cur.handCount < prev.handCount ? cur : prev);
      const bigJokerBombProb = this.probEngine.getBombProbability(
        'Big', playedCards, hand, dangerousOpponent.handCount, currentLevel
      );
      if (bigJokerBombProb > 0.35) {
        const penalty = bigJokerBombProb * this.weights.bombRiskPenaltyMultiplier;
        totalScore -= penalty;
        reasons.push(`对手炸弹风险P=${bigJokerBombProb.toFixed(2)}-${penalty.toFixed(0)}`);
      }
    }
  }

  // Stranded card detection
  const strandedResult = this.detectStrandedCards(futureStructure, hand, candidate.cards, currentLevel);
  totalScore += strandedResult.penalty;
  if (strandedResult.reason) reasons.push(strandedResult.reason);

  // Finishing bonuses
  if (candidate.cards.length === hand.length) {
    totalScore += this.weights.finishBonus;
    reasons.push(`出完收工+${this.weights.finishBonus}`);
  }
  if (futureStructure.turnsToEmpty <= 2 && futureStructure.totalCards <= 5) {
    const proximityBonus = (2 - futureStructure.turnsToEmpty + 1) * this.weights.proximityBonusPerTurn;
    totalScore += proximityBonus;
    reasons.push(`接近出完+${proximityBonus}(剩${futureStructure.totalCards}张${futureStructure.turnsToEmpty}轮)`);
  }

  // Strategy adjustments
  const strategyMode = preAnalysis.strategyMode;
  const cardValues = candidate.cards.map(c => this.ruleEngine.getRankValue(c.rank, currentLevel));
  const maxValue = Math.max(...cardValues);

  if (strategyMode === 'defend') {
    if (maxValue >= 98) {
      totalScore += this.weights.controlCardProtectionPenalty;
      reasons.push(`防守-保护控制牌${this.weights.controlCardProtectionPenalty}`);
    }
  } else if (strategyMode === 'support') {
    const avgValue = cardValues.reduce((a, b) => a + b, 0) / cardValues.length;
    if (avgValue > 10) {
      totalScore += this.weights.supportHighCardPenalty;
      reasons.push(`帮助-出小牌配合${this.weights.supportHighCardPenalty}`);
    }
  } else if (strategyMode === 'attack') {
    if (maxValue >= 98) {
      totalScore += this.weights.attackControlCardBonus;
      reasons.push(`进攻-使用控制牌+${this.weights.attackControlCardBonus}`);
    }
  }

  reasons.push(`[策略:${strategyMode}强度:${preAnalysis.myStrength}]`);

  return { score: totalScore, reasoning: reasons.join('; ') };
};

/**
 * Detect stranded cards after a play
 */
StrategicPlanner.prototype.detectStrandedCards = function(futureStructure, hand, cardsPlayed, currentLevel) {
  const remaining = hand.filter(c => !cardsPlayed.some(p => p.id === c.id));

  const bigCount = remaining.filter(c => c.rank === 'Big').length;
  const smallCount = remaining.filter(c => c.rank === 'Small').length;
  const levelCount = remaining.filter(c => c.rank === currentLevel).length;

  let penalty = 0;
  const reasons = [];

  if (bigCount === 1) {
    const isSingle = !futureStructure.groups.some(g =>
      g.cards.some(c => c.id === remaining.find(r => r.rank === 'Big')?.id)
    );
    if (isSingle) {
      penalty += this.weights.bigJokerStrandedPenalty;
      reasons.push(`大王单张${this.weights.bigJokerStrandedPenalty}`);
    }
  }
  if (smallCount === 1) {
    const isSingle = !futureStructure.groups.some(g =>
      g.cards.some(c => c.id === remaining.find(r => r.rank === 'Small')?.id)
    );
    if (isSingle) {
      penalty += this.weights.smallJokerStrandedPenalty;
      reasons.push(`小王单张${this.weights.smallJokerStrandedPenalty}`);
    }
  }
  if (levelCount >= 1) {
    const levelGroups = futureStructure.groups.filter(g =>
      g.cards.some(c => c.rank === currentLevel)
    );
    const hasLevelCombo = levelGroups.some(g =>
      ['Three', 'Bomb', 'FullHouse', 'FourWithOne', 'Pair'].includes(g.type)
    );
    if (!hasLevelCombo && levelCount >= 1) {
      penalty += this.weights.levelStrandedPenalty * Math.min(levelCount, 2);
      reasons.push(`级牌单张${levelCount}张${this.weights.levelStrandedPenalty * Math.min(levelCount, 2)}`);
    }
  }

  return { penalty, reason: reasons.join('; ') };
};

/**
 * Reset for new game
 */
StrategicPlanner.prototype.reset = function() {
  this.memory.reset();
};

module.exports = StrategicPlanner;
module.exports.DEFAULT_SCORING_WEIGHTS = DEFAULT_SCORING_WEIGHTS;
