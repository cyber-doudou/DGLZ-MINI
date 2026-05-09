// utils/game/DaGuaiLuZiRule.js
// Game rules engine for Da Guai Lu Zi

const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function DaGuaiLuZiRule() {
  // Empty constructor
}

/**
 * Get the numeric value of a rank given the current level
 * @param {string} rank
 * @param {string} currentLevel
 * @returns {number}
 */
DaGuaiLuZiRule.prototype.getRankValue = function(rank, currentLevel) {
  if (rank === 'Big') return 100;
  if (rank === 'Small') return 99;
  if (rank === currentLevel) return 98;

  const baseValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  return baseValues[rank] || 0;
};

/**
 * Create a shuffled deck of cards
 * @param {Object} settings
 * @param {string} currentLevel
 * @returns {Array}
 */
DaGuaiLuZiRule.prototype.createDeck = function(settings, currentLevel) {
  const deck = [];
  const deckCount = settings.deckCount || 3;

  for (let i = 0; i < deckCount; i++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${suit}-${rank}-${i}`,
          suit: suit,
          rank: rank,
          value: this.getRankValue(rank, currentLevel)
        });
      }
    }
    deck.push({ id: `Joker-Small-${i}`, suit: 'Joker', rank: 'Small', value: this.getRankValue('Small', currentLevel) });
    deck.push({ id: `Joker-Big-${i}`, suit: 'Joker', rank: 'Big', value: this.getRankValue('Big', currentLevel) });
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

/**
 * Deal cards to players
 * @param {Array} deck
 * @param {number} playerCount
 * @returns {Array}
 */
DaGuaiLuZiRule.prototype.dealCards = function(deck, playerCount) {
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push([]);
  }
  let currentPlayer = 0;

  for (const card of deck) {
    hands[currentPlayer].push(card);
    currentPlayer = (currentPlayer + 1) % playerCount;
  }

  return hands;
};

/**
 * Validate if a play is legal
 * @param {Array} cards
 * @param {Object|null} lastPlay
 * @param {Array} hand
 * @param {string} currentLevel
 * @returns {boolean}
 */
DaGuaiLuZiRule.prototype.validatePlay = function(cards, lastPlay, hand, currentLevel) {
  if (cards.length === 0) return true;

  if (![1, 2, 3, 5].includes(cards.length)) return false;

  const handIds = new Set(hand.map(c => c.id));
  for (const c of cards) {
    if (!handIds.has(c.id)) return false;
  }

  const currentPlayCombo = this.analyzeCombination(cards, currentLevel);
  if (!currentPlayCombo.isValid) return false;

  if (!lastPlay || lastPlay.cards.length === 0) return true;

  const lastPlayCombo = this.analyzeCombination(lastPlay.cards, currentLevel);
  if (!lastPlayCombo.isValid) return true;

  if (cards.length !== lastPlay.cards.length) return false;

  return this.compareParsedCombos(currentPlayCombo, lastPlayCombo, currentLevel);
};

/**
 * Compare two plays
 * @param {Array} newPlay
 * @param {Array} lastPlay
 * @param {string} currentLevel
 * @returns {boolean}
 */
DaGuaiLuZiRule.prototype.compareCards = function(newPlay, lastPlay, currentLevel) {
  const c1 = this.analyzeCombination(newPlay, currentLevel);
  const c2 = this.analyzeCombination(lastPlay, currentLevel);
  if (!c1.isValid) return false;
  if (!c2.isValid) return true;
  return this.compareParsedCombos(c1, c2, currentLevel);
};

/**
 * Compare two parsed combinations
 * @param {Object} c1
 * @param {Object} c2
 * @param {string} currentLevel
 * @returns {boolean}
 */
DaGuaiLuZiRule.prototype.compareParsedCombos = function(c1, c2, currentLevel) {
  if (c1.type === c2.type) {
    return c1.value > c2.value;
  }
  const typeRank = {
    'Single': 1, 'Pair': 1, 'Three': 1,
    'Straight': 2, 'Flush': 3, 'FullHouse': 4, 'FourWithOne': 5, 'StraightFlush': 6, 'Bomb': 7
  };
  return typeRank[c1.type] > typeRank[c2.type];
};

/**
 * Calculate game score (placeholder)
 * @param {Object} gameState
 * @returns {Object}
 */
DaGuaiLuZiRule.prototype.calculateScore = function(gameState) {
  return { team0: 0, team1: 0 };
};

/**
 * Get nominal value of a rank (for straights)
 * @param {string} rank
 * @returns {number}
 */
DaGuaiLuZiRule.prototype.getNominalValue = function(rank) {
  const baseValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return baseValues[rank] || 0;
};

/**
 * Sort cards
 * @param {Array} cards
 * @param {'value'|'suit'} sortBy
 * @param {string} currentLevel
 * @returns {Array}
 */
DaGuaiLuZiRule.prototype.sortCards = function(cards, sortBy, currentLevel) {
  return [...cards].sort((a, b) => {
    const valA = this.getRankValue(a.rank, currentLevel);
    const valB = this.getRankValue(b.rank, currentLevel);
    if (sortBy === 'value') {
      if (valB !== valA) return valB - valA;
      return a.suit.localeCompare(b.suit);
    } else {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return valB - valA;
    }
  });
};

/**
 * Get play type for cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {string|null}
 */
DaGuaiLuZiRule.prototype.getPlayType = function(cards, currentLevel) {
  const combo = this.analyzeCombination(cards, currentLevel);
  return combo.isValid ? combo.type : null;
};

/**
 * Analyze a combination of cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {{isValid: boolean, type: string, value: number}}
 */
DaGuaiLuZiRule.prototype.analyzeCombination = function(cards, currentLevel) {
  if (![1, 2, 3, 5].includes(cards.length)) return { isValid: false, type: '', value: 0 };

  const wildcards = cards.filter(c => c.rank === 'Big' || c.rank === 'Small');
  const normalCards = cards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const normalValues = normalCards.map(c => this.getRankValue(c.rank, currentLevel)).sort((a, b) => b - a);

  if (cards.length === 1) {
    if (wildcards.length > 0) return { isValid: true, type: 'Single', value: this.getRankValue(wildcards[0].rank, currentLevel) };
    return { isValid: true, type: 'Single', value: normalValues[0] };
  }

  if (cards.length === 2) {
    if (normalCards.length <= 1) return { isValid: true, type: 'Pair', value: normalCards.length === 1 ? normalValues[0] : 100 };
    if (normalValues[0] === normalValues[1]) return { isValid: true, type: 'Pair', value: normalValues[0] };
    return { isValid: false, type: '', value: 0 };
  }

  if (cards.length === 3) {
    if (normalCards.length <= 1) return { isValid: true, type: 'Three', value: normalCards.length === 1 ? normalValues[0] : 100 };
    const allSame = normalValues.every(v => v === normalValues[0]);
    if (allSame) return { isValid: true, type: 'Three', value: normalValues[0] };
    return { isValid: false, type: '', value: 0 };
  }

  // 5 cards logic
  let bestTypeRank = -1;
  let bestType = '';
  let bestValue = -1;

  const setBest = function(t, v, r) {
    if (r > bestTypeRank || (r === bestTypeRank && v > bestValue)) {
      bestTypeRank = r; bestType = t; bestValue = v;
    }
  };

  const getCounts = function() {
    const counts = {};
    normalValues.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return counts;
  };

  const counts = getCounts();
  const countVals = Object.values(counts).sort((a, b) => b - a);
  const uniqueVals = Object.keys(counts).map(Number).sort((a, b) => b - a);

  // Bomb (五同)
  if (normalCards.length <= 1 || countVals[0] === normalCards.length) {
    const val = normalCards.length > 0 ? uniqueVals[0] : 100;
    setBest('Bomb', val, 6);
  }

  // FourWithOne (四带一)
  if (normalCards.length <= 2 || countVals[0] >= normalCards.length - 1) {
    let mainVal = normalCards.length > 0 ? (countVals[0] >= 2 ? uniqueVals[0] : uniqueVals[0]) : 100;
    if (countVals.length === 2) {
      mainVal = counts[uniqueVals[0]] >= counts[uniqueVals[1]] ? uniqueVals[0] : uniqueVals[1];
    }
    setBest('FourWithOne', mainVal, 3);
  }

  // FullHouse (三带二)
  if (normalCards.length <= 3 || countVals[0] >= normalCards.length - 2) {
    let mainVal = normalCards.length > 0 ? uniqueVals[0] : 100;
    if (countVals.length === 2) {
      mainVal = counts[uniqueVals[0]] > counts[uniqueVals[1]] ? uniqueVals[0] : uniqueVals[1];
    }
    setBest('FullHouse', mainVal, 2);
  }

  // Flushes and Straights logic
  const canBeFlush = normalCards.length > 0 && normalCards.every(c => c.suit === normalCards[0].suit);
  let isStraight = false;
  let straightMax = 0;

  // Check straight
  const possibleStraightEnds = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
  const normalNominals = normalCards.map(c => this.getNominalValue(c.rank)).sort((a, b) => a - b);

  for (let end of possibleStraightEnds) {
    let needed = [end, end - 1, end - 2, end - 3, end - 4];
    let jokersNeeded = 0;
    let possible = true;
    let tempNominals = [...normalNominals];

    for (let nv of needed) {
      const valToFind = nv === 1 ? 14 : nv;
      const idx = tempNominals.indexOf(valToFind);
      if (idx !== -1) {
        tempNominals.splice(idx, 1);
      } else {
        jokersNeeded++;
      }
    }

    if (tempNominals.length === 0 && jokersNeeded <= wildcards.length) {
      isStraight = true;
      straightMax = end;
      break;
    }
  }

  if (canBeFlush && isStraight) {
    setBest('StraightFlush', straightMax, 5);
  }
  if (canBeFlush) {
    setBest('Flush', normalCards.length > 0 ? normalValues[0] : 100, 1);
  }
  if (isStraight) {
    setBest('Straight', straightMax, 0);
  }

  if (bestTypeRank >= 0) {
    return { isValid: true, type: bestType, value: bestValue };
  }

  return { isValid: false, type: '', value: 0 };
};

/**
 * Find all legal choices from a hand that can beat the last play
 * @param {Array} hand
 * @param {Object} gameState
 * @param {string} playerId
 * @param {Object} tactics
 * @returns {Array}
 */
DaGuaiLuZiRule.prototype.findLegalChoices = function(hand, gameState, playerId, tactics) {
  tactics = tactics || {};
  const allCandidates = [];
  const lastPlay = gameState.lastPlay;
  const currentLevel = gameState.currentLevel;

  // 1. Group cards by rank
  const rankGroups = {};
  const normalCards = hand.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const jokers = hand.filter(c => c.rank === 'Big' || c.rank === 'Small');

  normalCards.forEach(c => {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  });

  const targetLen = lastPlay && lastPlay.cards.length > 0 ? lastPlay.cards.length : 0;

  // Helper: Add if beats lastPlay
  const addIfValid = (cards) => {
    if (this.validatePlay(cards, lastPlay, hand, currentLevel)) {
      const type = this.getPlayType(cards, currentLevel) || 'Unknown';
      allCandidates.push({ type: type, cards: cards });
    }
  };

  // 2. Singles (1)
  if (targetLen === 0 || targetLen === 1) {
    hand.forEach(c => addIfValid([c]));
  }

  // 3. Pairs (2)
  if (targetLen === 0 || targetLen === 2) {
    Object.values(rankGroups).forEach(group => {
      if (group.length >= 2) addIfValid([group[0], group[1]]);
    });
    if (jokers.length >= 2) addIfValid([jokers[0], jokers[1]]);
    if (jokers.length >= 1) {
      normalCards.forEach(c => addIfValid([jokers[0], c]));
    }
  }

  // 4. Three (3)
  if (targetLen === 0 || targetLen === 3) {
    Object.values(rankGroups).forEach(group => {
      if (group.length >= 3) addIfValid([group[0], group[1], group[2]]);
    });
    if (jokers.length >= 1) {
      Object.values(rankGroups).forEach(group => {
        if (group.length >= 2) addIfValid([jokers[0], group[0], group[1]]);
      });
    }
    if (jokers.length >= 2) {
      normalCards.forEach(c => addIfValid([jokers[0], jokers[1], c]));
    }
    if (jokers.length >= 3) addIfValid([jokers[0], jokers[1], jokers[2]]);
  }

  // 5. Five (5)
  if (targetLen === 0 || targetLen === 5) {
    // Bombs
    Object.values(rankGroups).forEach(group => {
      const needed = 5 - group.length;
      if (needed >= 0 && jokers.length >= needed) {
        addIfValid([...group, ...jokers.slice(0, needed)]);
      }
    });

    // Full Houses (natural only)
    Object.keys(rankGroups).forEach(r1 => {
      Object.keys(rankGroups).forEach(r2 => {
        if (r1 === r2) return;
        if (r1 === currentLevel || r2 === currentLevel) return;
        const g1 = rankGroups[r1];
        const g2 = rankGroups[r2];
        if (g1.length >= 3 && g2.length >= 2) {
          addIfValid([...g1.slice(0, 3), ...g2.slice(0, 2)]);
        }
      });
    });

    // Straights
    const possibleEnds = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    for (let end of possibleEnds) {
      const neededNominals = Array.from({ length: 5 }, (_, i) => end - i);
      const combo = [];
      let jokersUsed = 0;

      for (let nVal of neededNominals) {
        const valToFind = nVal === 1 ? 14 : nVal;
        const cardInHand = hand.find(c =>
          c.rank !== 'Big' && c.rank !== 'Small' &&
          this.getNominalValue(c.rank) === valToFind &&
          !combo.some(cc => cc.id === c.id)
        );

        if (cardInHand) {
          combo.push(cardInHand);
        } else {
          jokersUsed++;
        }
      }

      if (jokersUsed <= jokers.length) {
        addIfValid([...combo, ...jokers.slice(0, jokersUsed)]);
      }
    }
  }

  // 6. Pass
  if (lastPlay && lastPlay.cards.length > 0) {
    allCandidates.push({ type: 'Pass', cards: [] });
  }

  // Dedup
  const deduped = allCandidates.filter((v, i, a) =>
    a.findIndex(t => t.cards.map(c => c.id).sort().join(',') === v.cards.map(c => c.id).sort().join(',')) === i
  );

  // Score and sort
  const scoredCandidates = deduped.map(c => ({
    ...c,
    score: this.scoreCandidate(c, hand, gameState, playerId, tactics)
  })).sort((a, b) => b.score - a.score);

  return scoredCandidates.slice(0, 30);
};

/**
 * Score a candidate for sorting (lightweight heuristic)
 * @param {Object} candidate
 * @param {Array} hand
 * @param {Object} gameState
 * @param {string} playerId
 * @param {Object} tactics
 * @returns {number}
 */
DaGuaiLuZiRule.prototype.scoreCandidate = function(candidate, hand, gameState, playerId, tactics) {
  const lastPlay = gameState.lastPlay;
  const currentLevel = gameState.currentLevel;
  const players = gameState.players;
  const me = players.find(p => p.id === playerId);
  const myTeam = me && me.team;

  const analysis = this.analyzeCombination(candidate.cards, currentLevel);

  let score = 0;
  if (candidate.type !== 'Pass') {
    // Prefer playing smaller cards
    score -= analysis.value;

    // Bonus for clearing trash singles when leading
    if (!lastPlay && candidate.type === 'Single' && analysis.value < 10) {
      score += 30;
    }
    // Bonus for pairs
    if (candidate.type === 'Pair') {
      score += 15;
    }
    // Bonus for 5-card combos
    if (candidate.cards.length === 5) {
      score += 25;
    }

    // Light penalty for using jokers/level cards
    const jokersUsed = candidate.cards.filter(c => c.rank === 'Big' || c.rank === 'Small').length;
    score -= jokersUsed * 50;

    const levelCardsUsed = candidate.cards.filter(c => c.rank === currentLevel).length;
    score -= levelCardsUsed * 40;
  }

  // Team awareness: prefer Pass when teammate is winning
  if (lastPlay && lastPlay.cards.length > 0) {
    const lastPlayer = players.find(p => p.id === lastPlay.playerId);
    if (lastPlayer && lastPlayer.team === myTeam) {
      if (candidate.type === 'Pass') {
        score += 200;
      } else {
        score -= 300;
      }
    }
  }

  return score;
};

module.exports = DaGuaiLuZiRule;
