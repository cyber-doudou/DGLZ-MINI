// utils/game/types.js
// Type definitions for Da Guai Lu Zi game

/**
 * @typedef {'Spades' | 'Hearts' | 'Clubs' | 'Diamonds' | 'Joker'} Suit
 * @typedef {'2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'Small' | 'Big'} Rank
 */

/**
 * @typedef {Object} Card
 * @property {string} id - Unique identifier (e.g., 'Spades-A-1')
 * @property {Suit} suit
 * @property {Rank} rank
 * @property {number} value - Numeric value for sorting/comparison
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {boolean} isReady
 * @property {boolean} isHost
 * @property {boolean} isOnline
 * @property {boolean} isAutoPlay - AI controlled
 * @property {number} handCount
 * @property {Card[]} [hand] - Only visible to self or server
 * @property {number} [team] - 0 or 1
 */

/**
 * @typedef {Object} PlayAction
 * @property {string} playerId
 * @property {Card[]} cards - Empty array = pass
 * @property {string} playType - 'Single', 'Pair', 'Three', 'Straight', etc.
 */

/**
 * @typedef {Object} TributePair
 * @property {string} payerId
 * @property {string} receiverId
 * @property {Card} tributeCard
 * @property {Card[]} [returnedCards]
 * @property {Card} [finalCardGivenBack]
 * @property {boolean} resolved
 */

/**
 * @typedef {Object} TributeState
 * @property {'Returning' | 'Receiving'} phase
 * @property {TributePair[]} pairs
 */

/**
 * @typedef {Object} GameState
 * @property {string} roomId
 * @property {'Waiting' | 'Playing' | 'Tribute' | 'Finished'} status
 * @property {Player[]} players
 * @property {number} currentPlayerIndex
 * @property {PlayAction | null} lastPlay
 * @property {PlayAction[]} history
 * @property {number} deckCount
 * @property {number | null} cutPlayerIndex
 * @property {Rank} currentLevel
 * @property {Rank} team1Level
 * @property {Rank} team2Level
 * @property {number} currentBankerTeam
 * @property {GameSettings} settings
 * @property {string[]} finishOrder
 * @property {TributeState} [tribute]
 * @property {Object} [lastGameResult]
 */

/**
 * @typedef {Object} GameSettings
 * @property {number} deckCount
 * @property {boolean} allowSpecificCombinations
 */

// Export for use in other modules
module.exports = {
  // Re-export constructors for creating instances
};
