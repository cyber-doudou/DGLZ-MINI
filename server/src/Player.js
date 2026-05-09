// Player session class

const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(ws, name) {
    this.id = uuidv4();
    this.ws = ws;
    this.name = name;
    this.seat = -1;
    this.team = -1;
    this.isHost = false;
    this.isReady = false;
    this.isAutoPlay = false; // For AI players
    this.handCount = 0;
    this.hand = [];
  }

  send(message) {
    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify(message));
    }
  }

  setHand(hand) {
    this.hand = hand;
    this.handCount = hand ? hand.length : 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      seat: this.seat,
      team: this.team,
      isHost: this.isHost,
      isReady: this.isReady,
      isAutoPlay: this.isAutoPlay,
      handCount: this.handCount
      // Don't send hand content to other players
    };
  }

  toJSONWithHand() {
    return {
      ...this.toJSON(),
      hand: this.hand // Only send to the player themselves
    };
  }
}

module.exports = Player;
