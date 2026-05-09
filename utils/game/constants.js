// utils/game/constants.js
// Game constants for Da Guai Lu Zi

const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKER_RANKS = ['Small', 'Big'];

// Special values
const VALUE_SMALL = 99;
const VALUE_BIG = 100;
const VALUE_LEVEL = 98;

// Default settings
const DEFAULT_DECK_COUNT = 3;
const DEFAULT_PLAYER_COUNT = 6;
const CARDS_PER_PLAYER = 27; // 162 / 6 = 27

// Card type rankings (for comparison)
const TYPE_RANK = {
  'Bomb': 7,
  'StraightFlush': 6,
  'FourWithOne': 5,
  'FullHouse': 4,
  'Flush': 3,
  'Straight': 2,
  'Three': 1,
  'Pair': 1,
  'Single': 0,
};

// Suit symbols for display
const SUIT_SYMBOLS = {
  'Spades': '♠',
  'Hearts': '♥',
  'Clubs': '♣',
  'Diamonds': '♦',
  'Joker': '★',
};

// Rank display names
const RANK_DISPLAY = {
  'Small': '小王',
  'Big': '大王',
  '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

// Phase types
const PHASE_TYPES = {
  OPENING: 'Opening',
  MIDGAME: 'MidGame',
  ENDGAME: 'Endgame',
  EMERGENCY: 'Emergency',
  COASTING: 'Coasting',
};

// Default phase weights
const DEFAULT_PHASE_WEIGHTS = {
  trashClearBonus: 40,
  jokerPenalty: -80,
  pairBonus: 15,
  fiveCardBonus: 25,
  efficiencyBonus: 50,
  blockBonus: 100,
  toppingTeammatePenalty: -100,
  passForTeammateBonus: 200,
  allowBombSacrifice: false,
};

// Default scoring weights
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

module.exports = {
  SUITS,
  RANKS,
  JOKER_RANKS,
  VALUE_SMALL,
  VALUE_BIG,
  VALUE_LEVEL,
  DEFAULT_DECK_COUNT,
  DEFAULT_PLAYER_COUNT,
  CARDS_PER_PLAYER,
  TYPE_RANK,
  SUIT_SYMBOLS,
  RANK_DISPLAY,
  PHASE_TYPES,
  DEFAULT_PHASE_WEIGHTS,
  DEFAULT_SCORING_WEIGHTS,
};
