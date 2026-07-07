const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { createGame, gameMeta } = require('./games');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory store for game rooms
const rooms = new Map(); // roomCode -> GameRoom instance
const roomTimers = {};
const roomTimeLeft = {}; // roomCode -> current seconds remaining (for reconnect sync)

// Generic countdown. The mechanism (ticking, timer_update) lives here; WHAT to do
// when it expires is the game's decision, via room.onTimerExpire(ctx).
function startRoomTimer(room) {
  if (!room) return;
  const roomCode = room.roomCode;
  if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);

  let timeLeft = room.settings.timer;
  roomTimeLeft[roomCode] = timeLeft;
  io.to(roomCode).emit('timer_update', timeLeft);

  roomTimers[roomCode] = setInterval(() => {
    timeLeft--;
    roomTimeLeft[roomCode] = timeLeft;
    io.to(roomCode).emit('timer_update', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(roomTimers[roomCode]);
      delete roomTimers[roomCode];
      room.onTimerExpire(makeCtx(room)); // the game decides what happens next
    }
  }, 1000);
}

function stopRoomTimer(roomCode) {
  clearInterval(roomTimers[roomCode]);
  delete roomTimers[roomCode];
  delete roomTimeLeft[roomCode];
  io.to(roomCode).emit('timer_update', null);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function broadcastGameState(room) {
  room.players.forEach(p => {
    if (p.socketId) {
      io.to(p.socketId).emit('game_state_update', room.getState(p.id));
    }
  });
}

// The bridge a game uses to drive the server (sockets + timers) without knowing
// anything about them. This is the ONLY coupling point between engine and games.
function makeCtx(room) {
  return {
    broadcast: () => broadcastGameState(room),
    startTimer: () => startRoomTimer(room),
    stopTimer: () => stopRoomTimer(room.roomCode),
    emitRoom: (event, data) => io.to(room.roomCode).emit(event, data),
    emitPlayer: (playerId, event, data) => {
      const p = room.getPlayer(playerId);
      if (p?.socketId) io.to(p.socketId).emit(event, data);
    },
    after: (ms, fn) => setTimeout(fn, ms),
  };
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Create Room
  socket.on('create_room', (payload, callback) => {
    // Accept both the legacy string form and { name, gameType } for the game picker
    const playerName = typeof payload === 'string' ? payload : payload?.name;
    const gameType = (typeof payload === 'object' && payload?.gameType) || 'werewolf';

    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode(); // avoid overwriting an existing room
    }
    const newRoom = createGame(gameType, roomCode);

    const playerId = crypto.randomUUID();
    const player = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      isHost: true,
      role: null,
      isAlive: true,
    };
    
    newRoom.addPlayer(player);
    rooms.set(roomCode, newRoom);
    
    socket.join(roomCode);
    
    callback({
      success: true,
      roomCode,
      playerId: playerId,
      gameState: newRoom.getState(playerId)
    });
    
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, playerName }, callback) => {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }
    
    if (room.phase !== 'LOBBY') {
      return callback({ success: false, message: 'Game has already started' });
    }

    const maxPlayers = gameMeta(room.gameType).maxPlayers;
    if (room.players.length >= maxPlayers) {
      return callback({ success: false, message: `Room is full (max ${maxPlayers} players)` });
    }

    if (room.players.some(p => p.name === playerName)) {
      return callback({ success: false, message: 'Name already taken in this room' });
    }

    const playerId = crypto.randomUUID();
    const player = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      isHost: false,
      role: null,
      isAlive: true,
    };
    
    room.addPlayer(player);
    socket.join(code);
    
    callback({ success: true, playerId: playerId, gameState: room.getState(playerId) });
    broadcastGameState(room);
  });

  // 2.5 Reconnect Player
  socket.on('reconnect_player', ({ roomCode, playerId }, callback) => {
    if (!roomCode || !playerId) return callback({ success: false });
    
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }
    
    const player = room.getPlayer(playerId);
    if (!player) {
      return callback({ success: false, message: 'Player not found in room' });
    }

    player.socketId = socket.id;
    socket.join(code);

    callback({ success: true, playerId: playerId, gameState: room.getState(playerId) });
    // Sync the running countdown so a refreshed client sees the timer immediately
    if (roomTimeLeft[code] != null) {
      socket.emit('timer_update', roomTimeLeft[code]);
    }
    broadcastGameState(room);
  });

  // 3. Start Game — generic: begin, then let the game kick off its first phase
  socket.on('start_game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room || room.getHost()?.socketId !== socket.id) return;
    if (room.startGame()) {
      broadcastGameState(room);
      room.onStart(makeCtx(room));
    } else {
      socket.emit('error_msg', 'ไม่สามารถเริ่มเกมได้ (ผู้เล่นไม่พอ)');
    }
  });

  // 4. Game actions — forwarded verbatim to the current game's handleEvent.
  // The server stays game-agnostic; each game decides what these mean.
  // 'game_action' is the generic, game-agnostic channel: any game can define its
  // own action types and read payload.type in handleEvent — no new socket event
  // per game. (The werewolf-specific names below are kept for that game.)
  const GAME_EVENTS = ['game_action', 'start_voting', 'night_action', 'witch_action', 'hunter_action', 'vote'];
  GAME_EVENTS.forEach((event) => {
    socket.on(event, (payload) => {
      const roomCode = typeof payload === 'string' ? payload : payload?.roomCode;
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      room.handleEvent(event, player, payload, makeCtx(room));
    });
  });

  // 7. Play Again — generic
  socket.on('play_again', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id) {
      stopRoomTimer(roomCode);
      room.resetGame();
      broadcastGameState(room);
    }
  });

  // 8. Chat Message — the game decides channel/visibility via buildChatMessage
  socket.on('chat_message', ({ roomCode, text, type }) => {
    const room = rooms.get(roomCode);
    if (!room || !text || !text.trim()) return;

    const sender = room.players.find(p => p.socketId === socket.id);
    if (!sender) return;

    const msg = room.buildChatMessage(sender, text.trim(), type);
    if (!msg) return; // game suppressed it (e.g. no global chat at night)

    room.addMessage(msg);
    broadcastGameState(room);
  });

  // 9. Update Settings
  socket.on('update_settings', ({ roomCode, settings }) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id && room.phase === 'LOBBY') {
       room.updateSettings(settings);
       broadcastGameState(room);
    }
  });

  // 10. Kick Player
  socket.on('kick_player', ({ roomCode, targetId }) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id && room.phase === 'LOBBY') {
       const target = room.players.find(p => p.id === targetId);
       if (target) {
          room.players = room.players.filter(p => p.id !== targetId);
          io.to(target.socketId).emit('kicked');
          broadcastGameState(room);
       }
    }
  });

  // 10.5 Leave Room (voluntary exit back to the home screen)
  socket.on('leave_room', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const wasHost = player.isHost;
    room.removePlayer(player.id);
    socket.leave(roomCode);

    const humans = room.players.filter(p => !p.isBot);
    if (humans.length === 0) {
      // No humans left (empty, or only bots) — tear the room down.
      stopRoomTimer(roomCode);
      rooms.delete(roomCode);
    } else {
      if (wasHost) {
        humans[0].isHost = true; // hand host to a human, never a bot
      }
      broadcastGameState(room);
    }
  });

  // 11. Get Public Rooms
  socket.on('get_public_rooms', () => {
     const publicRooms = [];
     for (const [code, room] of rooms.entries()) {
        const meta = gameMeta(room.gameType);
        if (room.phase === 'LOBBY' && room.players.length < meta.maxPlayers) {
           publicRooms.push({
              roomCode: code,
              gameType: room.gameType,
              gameLabel: meta.label,
              hostName: room.getHost()?.name || 'Unknown',
              playerCount: room.players.length,
              maxPlayers: meta.maxPlayers
           });
        }
     }
     socket.emit('public_rooms_list', publicRooms);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [code, room] of rooms.entries()) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
         player.socketId = null; // Mark as disconnected but retain player data
         
         if (room.phase === 'LOBBY') {
             room.removePlayer(player.id);
             const humans = room.players.filter(p => !p.isBot);
             if (humans.length === 0) {
                 stopRoomTimer(code);
                 rooms.delete(code);
             } else {
                 if (player.isHost) {
                     humans[0].isHost = true;
                 }
                 broadcastGameState(room);
             }
         } else {
             // Let them stay in the game state, they can reconnect by refreshing.
             broadcastGameState(room);
         }
         break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
