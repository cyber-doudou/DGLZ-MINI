// utils/ai/AIService.js
// AI Service for WeChat Miniprogram
// Uses full StrategicPlanner for decision making

const StrategicPlanner = require('./StrategicPlanner.js');

function AIService(gameEngine) {
  this.gameEngine = gameEngine;
  this.ruleEngine = gameEngine.ruleEngine;
  this.planner = new StrategicPlanner(this.ruleEngine, true);
}

/**
 * Get AI decision for a player
 * @param {string} playerId
 * @param {Object} gameState
 * @returns {Object|null}
 */
AIService.prototype.getAIDecision = function(playerId, gameState) {
  // Use gameEngine to get actual hand (bypasses sanitization)
  const hand = this.gameEngine.getPlayerHand(playerId);
  if (!hand || hand.length === 0) {
    return { type: 'Pass', cards: [], score: 0, reasoning: 'No cards' };
  }

  // Use StrategicPlanner for decision
  const decision = this.planner.selectPlay(hand, gameState, playerId);

  return decision;
};

/**
 * Get current phase from planner
 * @returns {Object}
 */
AIService.prototype.getCurrentPhase = function() {
  return this.planner.getCurrentPhase();
};

/**
 * Set AI weights
 * @param {Object} newWeights
 */
AIService.prototype.setWeights = function(newWeights) {
  this.planner.setWeights(newWeights);
};

/**
 * Get current AI weights
 * @returns {Object}
 */
AIService.prototype.getWeights = function() {
  return this.planner.getWeights();
};

/**
 * Reset AI memory (for new game)
 */
AIService.prototype.reset = function() {
  this.planner.reset();
};

module.exports = AIService;
