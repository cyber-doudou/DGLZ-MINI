// NetworkManager - WebSocket connection management for multiplayer

const MessageBus = require('./MessageBus');

const MessageTypes = {
  // Client -> Server
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  LEAVE_ROOM: 'LEAVE_ROOM',
  READY_TO_START: 'READY_TO_START',
  START_GAME: 'START_GAME',
  PLAY_CARDS: 'PLAY_CARDS',
  PASS: 'PASS',
  PING: 'PING',

  // Server -> Client
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_JOINED: 'ROOM_JOINED',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  PLAYER_READY: 'PLAYER_READY',
  GAME_STARTING: 'GAME_STARTING',
  GAME_STARTED: 'GAME_STARTED',
  GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',
  TURN_CHANGED: 'TURN_CHANGED',
  CARDS_PLAYED: 'CARDS_PLAYED',
  PLAYER_PASSED: 'PLAYER_PASSED',
  PLAYER_FINISHED: 'PLAYER_FINISHED',
  GAME_OVER: 'GAME_OVER',
  ERROR: 'ERROR',
  PONG: 'PONG'
};

class NetworkManager {
  constructor() {
    this.ws = null;
    this.messageBus = new MessageBus();
    this.playerId = null;
    this.roomId = null;
    this.serverUrl = '';
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.pingInterval = null;
    this.gameState = null;
  }

  connect(serverUrl) {
    if (this.ws || this.isConnecting) {
      console.warn('Already connected or connecting');
      return;
    }

    this.serverUrl = serverUrl;
    this.isConnecting = true;

    try {
      this.ws = wx.connectSocket({
        url: serverUrl,
        success: () => {
          console.log('WebSocket connecting...');
        },
        fail: (err) => {
          console.error('WebSocket connection failed:', err);
          this.isConnecting = false;
          this.messageBus.emit('error', { code: 'CONNECTION_FAILED', message: 'Failed to connect' });
        }
      });

      // Set up socket event handlers
      this.ws.onOpen(() => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        this.messageBus.emit('connected');
      });

      this.ws.onMessage((e) => {
        try {
          const message = JSON.parse(e.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.onClose(() => {
        console.log('WebSocket closed');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopPing();
        this.messageBus.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.onError((err) => {
        console.error('WebSocket error:', err);
        this.messageBus.emit('error', { code: 'WS_ERROR', message: err });
      });
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.isConnecting = false;
      this.messageBus.emit('error', { code: 'CONNECTION_ERROR', message: err.message });
    }
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.playerId = null;
    this.roomId = null;
    this.gameState = null;
  }

  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== 0) { // 0 = CONNECTING
      console.warn('WebSocket not connected');
      return false;
    }

    const message = {
      type,
      payload,
      timestamp: Date.now(),
      clientId: this.playerId
    };

    this.ws.send({
      data: JSON.stringify(message)
    });

    return true;
  }

  handleMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case MessageTypes.ROOM_CREATED:
        if (payload.roomId) {
          this.roomId = payload.roomId;
          this.playerId = payload.playerId;
        }
        this.messageBus.emit('roomCreated', payload);
        break;

      case MessageTypes.ROOM_JOINED:
        if (payload.roomId) {
          this.roomId = payload.roomId;
          this.playerId = payload.playerId;
        }
        if (payload.gameState) {
          this.gameState = payload.gameState;
        }
        this.messageBus.emit('roomJoined', payload);
        break;

      case MessageTypes.PLAYER_JOINED:
        this.messageBus.emit('playerJoined', payload);
        break;

      case MessageTypes.PLAYER_LEFT:
        this.messageBus.emit('playerLeft', payload);
        break;

      case MessageTypes.PLAYER_READY:
        this.messageBus.emit('playerReady', payload);
        break;

      case MessageTypes.GAME_STARTING:
        this.messageBus.emit('gameStarting', payload);
        break;

      case MessageTypes.GAME_STARTED:
        this.gameState = payload;
        this.messageBus.emit('gameStarted', payload);
        break;

      case MessageTypes.GAME_STATE_UPDATE:
        this.gameState = payload;
        this.messageBus.emit('gameStateUpdate', payload);
        break;

      case MessageTypes.TURN_CHANGED:
        this.messageBus.emit('turnChanged', payload);
        break;

      case MessageTypes.CARDS_PLAYED:
        this.messageBus.emit('cardsPlayed', payload);
        break;

      case MessageTypes.PLAYER_PASSED:
        this.messageBus.emit('playerPassed', payload);
        break;

      case MessageTypes.PLAYER_FINISHED:
        this.messageBus.emit('playerFinished', payload);
        break;

      case MessageTypes.GAME_OVER:
        this.messageBus.emit('gameOver', payload);
        break;

      case MessageTypes.ERROR:
        this.messageBus.emit('error', payload);
        break;

      case MessageTypes.PONG:
        // Heartbeat response
        break;
    }
  }

  // Room operations
  createRoom(playerName) {
    return this.send(MessageTypes.CREATE_ROOM, { playerName });
  }

  joinRoom(roomId, playerName) {
    return this.send(MessageTypes.JOIN_ROOM, { roomId, playerName });
  }

  leaveRoom() {
    return this.send(MessageTypes.LEAVE_ROOM);
  }

  readyToStart() {
    return this.send(MessageTypes.READY_TO_START);
  }

  startGame() {
    return this.send(MessageTypes.START_GAME);
  }

  // Game actions
  playCards(cards) {
    return this.send(MessageTypes.PLAY_CARDS, { cards });
  }

  pass() {
    return this.send(MessageTypes.PASS);
  }

  // Event subscriptions
  onConnected(callback) {
    return this.messageBus.on('connected', callback);
  }

  onDisconnected(callback) {
    return this.messageBus.on('disconnected', callback);
  }

  onRoomCreated(callback) {
    return this.messageBus.on('roomCreated', callback);
  }

  onRoomJoined(callback) {
    return this.messageBus.on('roomJoined', callback);
  }

  onPlayerJoined(callback) {
    return this.messageBus.on('playerJoined', callback);
  }

  onPlayerLeft(callback) {
    return this.messageBus.on('playerLeft', callback);
  }

  onPlayerReady(callback) {
    return this.messageBus.on('playerReady', callback);
  }

  onGameStarting(callback) {
    return this.messageBus.on('gameStarting', callback);
  }

  onGameStarted(callback) {
    return this.messageBus.on('gameStarted', callback);
  }

  onGameStateUpdate(callback) {
    return this.messageBus.on('gameStateUpdate', callback);
  }

  onTurnChanged(callback) {
    return this.messageBus.on('turnChanged', callback);
  }

  onCardsPlayed(callback) {
    return this.messageBus.on('cardsPlayed', callback);
  }

  onPlayerPassed(callback) {
    return this.messageBus.on('playerPassed', callback);
  }

  onPlayerFinished(callback) {
    return this.messageBus.on('playerFinished', callback);
  }

  onGameOver(callback) {
    return this.messageBus.on('gameOver', callback);
  }

  onError(callback) {
    return this.messageBus.on('error', callback);
  }

  // Utility
  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send(MessageTypes.PING);
    }, 30000); // Ping every 30 seconds
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.messageBus.emit('error', { code: 'RECONNECT_FAILED', message: 'Could not reconnect' });
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      if (!this.isConnected && this.serverUrl) {
        this.connect(this.serverUrl);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Getters
  getMyPlayerId() {
    return this.playerId;
  }

  getRoomId() {
    return this.roomId;
  }

  getGameState() {
    return this.gameState;
  }

  isInRoom() {
    return !!this.roomId;
  }

  isInGame() {
    return this.gameState && this.gameState.status === 'PLAYING';
  }
}

// Singleton instance
let instance = null;

function getNetworkManager() {
  if (!instance) {
    instance = new NetworkManager();
  }
  return instance;
}

module.exports = {
  NetworkManager,
  getNetworkManager,
  MessageTypes
};
