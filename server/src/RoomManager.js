// Room lifecycle management

const { v4: uuidv4 } = require('uuid');
const GameRoom = require('./GameRoom');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> GameRoom
    this.playerRooms = new Map(); // playerId -> roomId
  }

  createRoom(host) {
    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId, host);
    this.rooms.set(roomId, room);
    this.playerRooms.set(host.id, roomId);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomByPlayerId(playerId) {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  joinRoom(roomId, ws, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found', player: null };
    }

    const result = room.addPlayer(ws, playerName);
    if (!result.success) {
      return result;
    }

    this.playerRooms.set(result.player.id, roomId);
    return result;
  }

  leaveRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const player = room.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    // Remove room if empty
    if (room.players.length === 0) {
      room.destroy();
      this.rooms.delete(roomId);
    }

    return room;
  }

  generateRoomId() {
    // Generate a 6-digit room code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getRoomList() {
    // Return list of rooms available to join (not full, not started)
    const availableRooms = [];
    for (const [roomId, room] of this.rooms) {
      if (room.status === 'WAITING' && room.players.length < 6) {
        availableRooms.push({
          roomId,
          playerCount: room.players.length,
          hostName: room.host.name
        });
      }
    }
    return availableRooms;
  }
}

module.exports = RoomManager;
