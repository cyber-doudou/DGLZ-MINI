// DaGuaiLuZi WebSocket Server
// Entry point for HTTP + WebSocket server

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const MessageTypes = require('./protocol/MessageTypes');
const { validateMessage, validateMessageType } = require('./protocol/validator');
const RoomManager = require('./RoomManager');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Room management
const roomManager = new RoomManager();

// Store client info
const clients = new Map(); // ws -> { playerId, roomId }

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

// Room list endpoint
app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

// Create room endpoint (alternative to WebSocket)
app.post('/api/rooms', (req, res) => {
  // This would need body-parser middleware in production
  res.status(501).json({ error: 'Use WebSocket to create rooms' });
});

function handleMessage(ws, message) {
  const client = clients.get(ws);
  if (!client) return;

  // Validate message format
  const validation = validateMessage(message);
  if (!validation.valid) {
    ws.send(JSON.stringify({
      type: MessageTypes.ERROR,
      payload: { code: 'INVALID_MESSAGE', message: validation.error }
    }));
    return;
  }

  const { type, payload } = message;

  // Validate message type specific payload
  const typeValidation = validateMessageType(type, payload);
  if (!typeValidation.valid) {
    ws.send(JSON.stringify({
      type: MessageTypes.ERROR,
      payload: { code: 'INVALID_PAYLOAD', message: typeValidation.error }
    }));
    return;
  }

  // Handle message by type
  switch (type) {
    case MessageTypes.CREATE_ROOM: {
      const { playerName } = payload;

      // Leave current room if any
      if (client.roomId) {
        roomManager.leaveRoom(client.playerId);
      }

      // Create new room
      const Player = require('./Player');
      const player = new Player(ws, playerName);
      const room = roomManager.createRoom(player);

      client.playerId = player.id;
      client.roomId = room.roomId;
      clients.set(ws, client);

      ws.send(JSON.stringify({
        type: MessageTypes.ROOM_CREATED,
        payload: {
          roomId: room.roomId,
          playerId: player.id,
          players: room.players.map(p => p.toJSON())
        }
      }));
      break;
    }

    case MessageTypes.JOIN_ROOM: {
      const { roomId, playerName } = payload;

      // Leave current room if any
      if (client.roomId) {
        roomManager.leaveRoom(client.playerId);
      }

      const result = roomManager.joinRoom(roomId, ws, playerName);
      if (!result.success) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'JOIN_FAILED', message: result.error }
        }));
        return;
      }

      client.playerId = result.player.id;
      client.roomId = roomId;
      clients.set(ws, client);

      // Notify all players in room
      const room = result.room;
      room.broadcast({
        type: MessageTypes.PLAYER_JOINED,
        payload: { player: result.player.toJSON() }
      }, result.player.id);

      ws.send(JSON.stringify({
        type: MessageTypes.ROOM_JOINED,
        payload: {
          roomId: room.roomId,
          playerId: result.player.id,
          players: room.players.map(p => p.toJSON()),
          gameState: room.status === 'PLAYING' ? room.getGameStateForPlayer(result.player.id) : null
        }
      }));
      break;
    }

    case MessageTypes.LEAVE_ROOM: {
      const room = roomManager.leaveRoom(client.playerId);
      if (room) {
        room.broadcast({
          type: MessageTypes.PLAYER_LEFT,
          payload: { playerId: client.playerId }
        });
      }

      client.playerId = null;
      client.roomId = null;
      clients.set(ws, client);

      ws.send(JSON.stringify({
        type: MessageTypes.ROOM_CREATED,
        payload: { left: true }
      }));
      break;
    }

    case MessageTypes.READY_TO_START: {
      const room = roomManager.getRoomByPlayerId(client.playerId);
      if (!room) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'NOT_IN_ROOM', message: 'You are not in a room' }
        }));
        return;
      }

      const player = room.getPlayer(client.playerId);
      if (player) {
        player.isReady = true;
        room.broadcast({
          type: MessageTypes.PLAYER_READY,
          payload: { playerId: client.playerId, isReady: true }
        });
      }
      break;
    }

    case MessageTypes.START_GAME: {
      const room = roomManager.getRoomByPlayerId(client.playerId);
      if (!room) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'NOT_IN_ROOM', message: 'You are not in a room' }
        }));
        return;
      }

      const player = room.getPlayer(client.playerId);
      if (!player || !player.isHost) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'NOT_HOST', message: 'Only the host can start the game' }
        }));
        return;
      }

      const result = room.startGame();
      if (!result.success) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'START_FAILED', message: result.error }
        }));
      }
      // Game state is sent in room.startGame()
      break;
    }

    case MessageTypes.PLAY_CARDS: {
      const room = roomManager.getRoomByPlayerId(client.playerId);
      if (!room || room.status !== 'PLAYING') {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'NOT_PLAYING', message: 'Game is not in progress' }
        }));
        return;
      }

      const { cards } = payload;
      const result = room.playCards(client.playerId, cards);
      if (!result.success) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'PLAY_FAILED', message: result.error }
        }));
      }
      // State update is broadcast in room.playCards()
      break;
    }

    case MessageTypes.PASS: {
      const room = roomManager.getRoomByPlayerId(client.playerId);
      if (!room || room.status !== 'PLAYING') {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'NOT_PLAYING', message: 'Game is not in progress' }
        }));
        return;
      }

      const result = room.pass(client.playerId);
      if (!result.success) {
        ws.send(JSON.stringify({
          type: MessageTypes.ERROR,
          payload: { code: 'PASS_FAILED', message: result.error }
        }));
      }
      // State update is broadcast in room.pass()
      break;
    }

    case MessageTypes.PING: {
      ws.send(JSON.stringify({
        type: MessageTypes.PONG,
        payload: { timestamp: Date.now() }
      }));
      break;
    }

    default:
      ws.send(JSON.stringify({
        type: MessageTypes.ERROR,
        payload: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${type}` }
      }));
  }
}

function handleClose(ws) {
  const client = clients.get(ws);
  if (client && client.playerId) {
    const room = roomManager.leaveRoom(client.playerId);
    if (room) {
      room.broadcast({
        type: MessageTypes.PLAYER_LEFT,
        payload: { playerId: client.playerId }
      });
    }
  }
  clients.delete(ws);
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Initialize client
  clients.set(ws, { playerId: null, roomId: null });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (e) {
      console.error('Failed to parse message:', e);
      ws.send(JSON.stringify({
        type: MessageTypes.ERROR,
        payload: { code: 'PARSE_ERROR', message: 'Invalid JSON' }
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleClose(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleClose(ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`DaGuaiLuZi server running on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`HTTP API: http://localhost:${PORT}/api/rooms`);
});
