// utils/ai/HandAnalyzer.js
// Hand decomposition for AI - analyzes hand structure and groups

/**
 * @typedef {Object} CardGroup
 * @property {string} type - 'Bomb' | 'StraightFlush' | 'FourWithOne' | 'FullHouse' | 'Flush' | 'Straight' | 'Three' | 'Pair' | 'Single'
 * @property {Array} cards
 * @property {number} value
 * @property {string} priority - 'trash' | 'play_early' | 'play_mid' | 'hold'
 */

/**
 * @typedef {Object} HandStructure
 * @property {CardGroup[]} groups
 * @property {number} turnsToEmpty
 * @property {number} controlCards
 * @property {number} trashCount
 * @property {number} totalCards
 */

function HandAnalyzer(ruleEngine) {
  this.ruleEngine = ruleEngine;
}

/**
 * Main entry: Decompose a hand into an optimal set of non-overlapping play groups.
 * @param {Array} hand
 * @param {string} currentLevel
 * @returns {HandStructure}
 */
HandAnalyzer.prototype.decompose = function(hand, currentLevel) {
  // Try multiple decomposition strategies and pick the one with fewest turns
  const strategies = [
    this.decomposeGreedy(hand, currentLevel, 'fiveFirst'),
    this.decomposeGreedy(hand, currentLevel, 'pairsFirst'),
  ];

  const best = strategies.sort((a, b) => a.turnsToEmpty - b.turnsToEmpty)[0];

  // Tag priorities
  this.tagPriorities(best, currentLevel);

  return best;
};

/**
 * Evaluate what happens to the remaining hand after playing certain cards.
 * @param {Array} hand
 * @param {Array} cardsToPlay
 * @param {string} currentLevel
 * @returns {HandStructure}
 */
HandAnalyzer.prototype.evaluateAfterPlay = function(hand, cardsToPlay, currentLevel) {
  const playIds = new Set(cardsToPlay.map(c => c.id));
  const remaining = hand.filter(c => !playIds.has(c.id));
  return this.decompose(remaining, currentLevel);
};

/**
 * Greedy decomposition strategy
 * @param {Array} hand
 * @param {string} currentLevel
 * @param {string} strategy - 'fiveFirst' or 'pairsFirst'
 * @returns {HandStructure}
 */
HandAnalyzer.prototype.decomposeGreedy = function(hand, currentLevel, strategy) {
  const groups = [];
  let remaining = [...hand];

  const extract = (type, size) => {
    if (size === 5) {
      let found = true;
      while (found) {
        found = false;
        const combo = this.findBestFiveCardGroup(remaining, currentLevel, type);
        if (combo) {
          groups.push(combo);
          const comboIds = new Set(combo.cards.map(c => c.id));
          remaining = remaining.filter(c => !comboIds.has(c.id));
          found = true;
        }
      }
    }
  };

  const extractNOfAKind = (n, groupType) => {
    const rankGroups = this.groupByRank(remaining, currentLevel);
    for (const [rank, cards] of Object.entries(rankGroups)) {
      if (cards.length >= n) {
        const chosen = cards.slice(0, n);
        const value = this.ruleEngine.getRankValue(chosen[0].rank, currentLevel);
        groups.push({ type: groupType, cards: chosen, value: value, priority: 'play_early' });
        const chosenIds = new Set(chosen.map(c => c.id));
        remaining = remaining.filter(c => !chosenIds.has(c.id));
      }
    }
  };

  if (strategy === 'fiveFirst') {
    // 1. Extract Bombs
    extract('Bomb', 5);
    // 2. Extract StraightFlush
    extract('StraightFlush', 5);
    // 3. Extract FourWithOne
    extract('FourWithOne', 5);
    // 4. Extract FullHouse
    extract('FullHouse', 5);
    // 5. Extract Straights
    extract('Straight', 5);
    // 6. Extract Three
    extractNOfAKind(3, 'Three');
    // 7. Extract Pairs
    extractNOfAKind(2, 'Pair');
  } else {
    // Alternative: prioritize pairs/threes first
    extractNOfAKind(3, 'Three');
    extractNOfAKind(2, 'Pair');
    extract('Bomb', 5);
    extract('StraightFlush', 5);
    extract('Straight', 5);
    extract('FullHouse', 5);
    extract('FourWithOne', 5);
  }

  // Remaining cards are singles
  for (const c of remaining) {
    const value = this.ruleEngine.getRankValue(c.rank, currentLevel);
    groups.push({ type: 'Single', cards: [c], value: value, priority: 'play_early' });
  }

  const turnsToEmpty = groups.length;
  const controlCards = groups.filter(g =>
    g.type === 'Bomb' ||
    g.type === 'StraightFlush' ||
    (g.type === 'Single' && g.cards[0].rank === 'Big')
  ).length;
  const trashCount = groups.filter(g => g.type === 'Single' && g.value < 10).length;

  return {
    groups: groups,
    turnsToEmpty: turnsToEmpty,
    controlCards: controlCards,
    trashCount: trashCount,
    totalCards: hand.length,
  };
};

/**
 * Find best 5-card group of target type
 * @param {Array} cards
 * @param {string} currentLevel
 * @param {string} targetType
 * @returns {CardGroup|null}
 */
HandAnalyzer.prototype.findBestFiveCardGroup = function(cards, currentLevel, targetType) {
  const jokers = cards.filter(c => c.rank === 'Big' || c.rank === 'Small');
  const normals = cards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const rankGroups = this.groupByRank(normals, currentLevel);

  if (targetType === 'Bomb') {
    for (const [rank, group] of Object.entries(rankGroups)) {
      const needed = 5 - group.length;
      if (needed >= 0 && needed <= jokers.length) {
        const combo = [...group, ...jokers.slice(0, needed)];
        return {
          type: 'Bomb',
          cards: combo,
          value: this.ruleEngine.getRankValue(group[0].rank, currentLevel),
          priority: 'hold',
        };
      }
    }
    return null;
  }

  if (targetType === 'StraightFlush') {
    return this.findStraightFlush(cards, currentLevel);
  }

  if (targetType === 'Straight') {
    return this.findStraight(cards, currentLevel);
  }

  if (targetType === 'FullHouse') {
    return this.findFullHouse(cards, currentLevel);
  }

  if (targetType === 'FourWithOne') {
    return this.findFourWithOne(cards, currentLevel);
  }

  return null;
};

/**
 * Get nominal value of rank for straights
 * @param {string} rank
 * @returns {number}
 */
HandAnalyzer.prototype.getNominalValue = function(rank) {
  const vals = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  return vals[rank] || 0;
};

/**
 * Find a straight in cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {CardGroup|null}
 */
HandAnalyzer.prototype.findStraight = function(cards, currentLevel) {
  const normals = cards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const jokers = cards.filter(c => c.rank === 'Big' || c.rank === 'Small');

  // Try all possible 5-card straights
  const possibleEnds = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  for (const end of possibleEnds) {
    const needed = [end, end - 1, end - 2, end - 3, end - 4];
    const combo = [];
    let jokersUsed = 0;
    const usedIds = new Set();

    for (const nv of needed) {
      const cardInHand = normals.find(c =>
        this.getNominalValue(c.rank) === nv && !usedIds.has(c.id)
      );
      if (cardInHand) {
        combo.push(cardInHand);
        usedIds.add(cardInHand.id);
      } else {
        jokersUsed++;
      }
    }

    if (jokersUsed <= jokers.length && combo.length + jokersUsed === 5) {
      const fullCombo = [...combo, ...jokers.slice(0, jokersUsed)];
      // Verify it's a valid straight
      const analysis = this.ruleEngine.getPlayType(fullCombo, currentLevel);
      if (analysis === 'Straight' || analysis === 'StraightFlush') {
        return {
          type: 'Straight',
          cards: fullCombo,
          value: end,
          priority: 'play_early',
        };
      }
    }
  }
  return null;
};

/**
 * Find a straight flush in cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {CardGroup|null}
 */
HandAnalyzer.prototype.findStraightFlush = function(cards, currentLevel) {
  const jokers = cards.filter(c => c.rank === 'Big' || c.rank === 'Small');

  const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  for (const suit of suits) {
    const suitCards = cards.filter(c => c.suit === suit);
    const normals = suitCards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
    const possibleEnds = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

    for (const end of possibleEnds) {
      const needed = [end, end - 1, end - 2, end - 3, end - 4];
      const combo = [];
      let jokersUsed = 0;
      const usedIds = new Set();

      for (const nv of needed) {
        const cardInHand = normals.find(c =>
          this.getNominalValue(c.rank) === nv && !usedIds.has(c.id)
        );
        if (cardInHand) {
          combo.push(cardInHand);
          usedIds.add(cardInHand.id);
        } else {
          jokersUsed++;
        }
      }

      if (jokersUsed <= jokers.length && combo.length + jokersUsed === 5) {
        const fullCombo = [...combo, ...jokers.slice(0, jokersUsed)];
        return {
          type: 'StraightFlush',
          cards: fullCombo,
          value: end,
          priority: 'hold',
        };
      }
    }
  }
  return null;
};

/**
 * Find a full house in cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {CardGroup|null}
 */
HandAnalyzer.prototype.findFullHouse = function(cards, currentLevel) {
  const normals = cards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const rankGroups = this.groupByRank(normals, currentLevel);
  const entries = Object.entries(rankGroups).sort((a, b) => b[1].length - a[1].length);

  // Find a triple
  for (const [r1, g1] of entries) {
    if (g1.length >= 3 && r1 !== currentLevel) {
      // Find a pair from remaining
      for (const [r2, g2] of entries) {
        if (r2 === r1) continue;
        if (g2.length >= 2) {
          const combo = [...g1.slice(0, 3), ...g2.slice(0, 2)];
          return {
            type: 'FullHouse',
            cards: combo,
            value: this.ruleEngine.getRankValue(g1[0].rank, currentLevel),
            priority: 'play_mid',
          };
        }
      }
    }
  }
  return null;
};

/**
 * Find a four-with-one in cards
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {CardGroup|null}
 */
HandAnalyzer.prototype.findFourWithOne = function(cards, currentLevel) {
  const normals = cards.filter(c => c.rank !== 'Big' && c.rank !== 'Small');
  const jokers = cards.filter(c => c.rank === 'Big' || c.rank === 'Small');
  const rankGroups = this.groupByRank(normals, currentLevel);

  // Natural FourWithOne: 4 of a kind + kicker
  for (const [rank, group] of Object.entries(rankGroups)) {
    if (group.length >= 4) {
      const kicker = normals.find(c => c.rank !== group[0].rank);
      if (kicker) {
        return {
          type: 'FourWithOne',
          cards: [...group.slice(0, 4), kicker],
          value: this.ruleEngine.getRankValue(group[0].rank, currentLevel),
          priority: 'play_mid',
        };
      }
    }
  }

  // Joker-assisted: 3 of a kind + joker as 4th + kicker
  for (const [rank, group] of Object.entries(rankGroups)) {
    if (group.length >= 3 && jokers.length >= 1) {
      const kicker = normals.find(c => c.rank !== group[0].rank);
      if (kicker) {
        return {
          type: 'FourWithOne',
          cards: [...group.slice(0, 3), jokers[0], kicker],
          value: this.ruleEngine.getRankValue(group[0].rank, currentLevel),
          priority: 'play_mid',
        };
      }
    }
  }

  return null;
};

/**
 * Tag each group with a play priority based on its strategic value.
 * @param {HandStructure} structure
 * @param {string} currentLevel
 */
HandAnalyzer.prototype.tagPriorities = function(structure, currentLevel) {
  for (const group of structure.groups) {
    if (group.type === 'Bomb' || group.type === 'StraightFlush') {
      group.priority = 'hold';
    } else if (group.type === 'Single') {
      if (group.value < 10) {
        group.priority = 'trash';
      } else if (group.value >= 98) {
        group.priority = 'hold';
      } else {
        group.priority = 'play_mid';
      }
    } else if (group.type === 'Straight' || group.type === 'Flush') {
      group.priority = 'play_early';
    } else if (group.type === 'FullHouse' || group.type === 'FourWithOne') {
      group.priority = 'play_mid';
    } else if (group.type === 'Pair' || group.type === 'Three') {
      group.priority = group.value < 10 ? 'play_early' : 'play_mid';
    }
  }
};

/**
 * Group cards by their rank, excluding jokers.
 * @param {Array} cards
 * @param {string} currentLevel
 * @returns {Object}
 */
HandAnalyzer.prototype.groupByRank = function(cards, currentLevel) {
  const groups = {};
  for (const c of cards) {
    if (c.rank === 'Big' || c.rank === 'Small') continue;
    if (!groups[c.rank]) groups[c.rank] = [];
    groups[c.rank].push(c);
  }
  return groups;
};

module.exports = HandAnalyzer;
