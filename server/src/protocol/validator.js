// Message validation utilities

const MessageTypes = require('./MessageTypes');

function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Missing message type' };
  }

  if (!message.payload || typeof message.payload !== 'object') {
    return { valid: false, error: 'Missing payload' };
  }

  return { valid: true };
}

function validateCreateRoom(payload) {
  if (!payload.playerName || typeof payload.playerName !== 'string') {
    return { valid: false, error: 'Invalid playerName' };
  }
  if (payload.playerName.length > 20) {
    return { valid: false, error: 'playerName too long' };
  }
  return { valid: true };
}

function validateJoinRoom(payload) {
  if (!payload.roomId || typeof payload.roomId !== 'string') {
    return { valid: false, error: 'Invalid roomId' };
  }
  if (!payload.playerName || typeof payload.playerName !== 'string') {
    return { valid: false, error: 'Invalid playerName' };
  }
  return { valid: true };
}

function validatePlayCards(payload) {
  if (!Array.isArray(payload.cards)) {
    return { valid: false, error: 'cards must be an array' };
  }
  for (const card of payload.cards) {
    if (!card.id || !card.suit || !card.rank) {
      return { valid: false, error: 'Invalid card structure' };
    }
  }
  return { valid: true };
}

function validateMessageType(type, payload) {
  switch (type) {
    case MessageTypes.CREATE_ROOM:
      return validateCreateRoom(payload);
    case MessageTypes.JOIN_ROOM:
      return validateJoinRoom(payload);
    case MessageTypes.PLAY_CARDS:
      return validatePlayCards(payload);
    case MessageTypes.PASS:
    case MessageTypes.LEAVE_ROOM:
    case MessageTypes.READY_TO_START:
    case MessageTypes.START_GAME:
    case MessageTypes.PING:
      return { valid: true };
    default:
      return { valid: false, error: `Unknown message type: ${type}` };
  }
}

module.exports = {
  validateMessage,
  validateMessageType
};
