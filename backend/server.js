const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { GameRoom } = require('./gameLogic');

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
  
function startRoomTimer(roomCode, io) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (roomTimers[roomCode]) {
    clearInterval(roomTimers[roomCode]);
  }

  // Base time is based on settings. But NIGHT_WITCH might be shorter?
  // Let's use the normal timer for simplicity, or 30 seconds for Witch.
  let timeLeft = room.phase === 'NIGHT_WITCH' ? 30 : room.settings.timer;
  
  io.to(roomCode).emit('timer_update', timeLeft);

  roomTimers[roomCode] = setInterval(() => {
    timeLeft--;
    io.to(roomCode).emit('timer_update', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(roomTimers[roomCode]);
      delete roomTimers[roomCode];

      // Force transition if time is up
      if (room.phase === 'NIGHT') {
        room.resolveNight();
        processPhaseTransition(room, io);
      } else if (room.phase === 'NIGHT_WITCH') {
        room.resolveNightWitch();
        processPhaseTransition(room, io);
      } else if (room.phase === 'VOTING') {
        room.resolveVoting();
        processPhaseTransition(room, io);
      }
    }
  }, 1000);
}

function stopRoomTimer(roomCode, io) {
  clearInterval(roomTimers[roomCode]);
  delete roomTimers[roomCode];
  io.to(roomCode).emit('timer_update', null);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function broadcastGameState(room, io) {
  room.players.forEach(p => {
    if (p.socketId) {
      io.to(p.socketId).emit('game_state_update', room.getState(p.id));
    }
  });
}
function processPhaseTransition(room, io) {
  if (room.phase === 'HUNTER_REVENGE') {
     // Hunter needs time to act, maybe start a timer?
     startRoomTimer(room.roomCode, io);
  } else if (room.phase === 'NIGHT_WITCH') {
     // Witch phase
     startRoomTimer(room.roomCode, io);
  } else if (room.phase === 'DAY') {
     const winner = room.checkWinCondition();
     if (winner) {
        room.setPhase('END_GAME');
        room.winner = winner;
     } else {
        // Start discussion, then voting
        setTimeout(() => {
           if (room.phase === 'DAY') {
              room.setPhase('VOTING');
              startRoomTimer(room.roomCode, io);
              broadcastGameState(room, io);
           }
        }, 15000); // 15 seconds discussion
     }
  }
  broadcastGameState(room, io);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Create Room
  socket.on('create_room', (playerName, callback) => {
    const roomCode = generateRoomCode();
    const newRoom = new GameRoom(roomCode);
    
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
    broadcastGameState(room, io);
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
    broadcastGameState(room, io);
  });

  // 3. Start Game
  socket.on('start_game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id) {
      const success = room.startGame();
      if (success) {
        broadcastGameState(room, io);
        
        // After 5 seconds of role viewing, transition to night
        setTimeout(() => {
          if (room.phase === 'ROLE_VIEW') {
             room.setPhase('NIGHT');
             broadcastGameState(room, io);
             startRoomTimer(roomCode, io);
          }
        }, 5000);
      } else {
        socket.emit('error_msg', 'Not enough players (Minimum 4 required).');
      }
    }
  });

  // 4. Night Action
  socket.on('night_action', ({ roomCode, targetId }) => {
    const room = rooms.get(roomCode);
    if (room && room.phase === 'NIGHT') {
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.isAlive) return;

      const result = room.handleNightAction(player, targetId);
      
      if (player.role === 'Seer' && result) {
        socket.emit('seer_result', result);
      }
      
      broadcastGameState(room, io);

      if (room.checkNightEnd()) {
        stopRoomTimer(roomCode, io);
        room.resolveNight();
        processPhaseTransition(room, io);
      }
    }
  });

  // Night Action (Witch)
  socket.on('witch_action', ({ roomCode, action }) => {
    const room = rooms.get(roomCode);
    if (room && room.phase === 'NIGHT_WITCH') {
      const player = room.getPlayer(socket.playerId);
      if (player && player.isAlive && player.role === 'Witch') {
        const success = room.handleNightWitchAction(player, action);
        if (success) {
          stopRoomTimer(roomCode, io);
          processPhaseTransition(room, io);
        }
      }
    }
  });

  // 4.5 Hunter Action
  socket.on('hunter_action', ({ roomCode, targetId }) => {
    const room = rooms.get(roomCode);
    if (room && room.phase === 'HUNTER_REVENGE') {
       const player = room.players.find(p => p.socketId === socket.id);
       if (!player || player.id !== room.pendingHunter) return;
       
       stopRoomTimer(roomCode, io);
       room.handleHunterAction(targetId);
       processPhaseTransition(room, io);
    }
  });


  // 6. Day Vote
  socket.on('vote', ({ roomCode, targetId }) => {
    const room = rooms.get(roomCode);
    if (room && room.phase === 'VOTING') {
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.isAlive) return;

      room.handleVote(player.id, targetId);
      broadcastGameState(room, io);

      if (room.checkVotingEnd()) {
        stopRoomTimer(roomCode, io);
        room.resolveVoting();
        processPhaseTransition(room, io);
      }
    }
  });

  // 7. Play Again
  socket.on('play_again', (roomCode) => {
     const room = rooms.get(roomCode);
      if (room && room.getHost()?.socketId === socket.id) {
         stopRoomTimer(roomCode, io);
         room.resetGame();
         broadcastGameState(room, io);
     }
  });

  // 8. Chat Message
  socket.on('chat_message', ({ roomCode, text, type }) => {
    const room = rooms.get(roomCode);
    if (!room || !text.trim()) return;
    
    const sender = room.players.find(p => p.socketId === socket.id);
    if (!sender) return;

    let actualType = 'GLOBAL';
    if (!sender.isAlive) {
       actualType = 'DEAD';
    } else if (type === 'WEREWOLF' && sender.role === 'Werewolf') {
       actualType = 'WEREWOLF';
    }

    // Prevent alive players from talking globally during NIGHT
    if (actualType === 'GLOBAL' && sender.isAlive && room.phase === 'NIGHT') {
        return;
    }

    const msg = {
      id: crypto.randomUUID(),
      senderId: sender.id,
      senderName: sender.name,
      text: text.trim(),
      type: actualType,
      timestamp: Date.now()
    };
    
    room.addMessage(msg);
    broadcastGameState(room, io);
  });

  // 9. Update Settings
  socket.on('update_settings', ({ roomCode, settings }) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id && room.phase === 'LOBBY') {
       room.updateSettings(settings);
       broadcastGameState(room, io);
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
          broadcastGameState(room, io);
       }
    }
  });

  // 11. Get Public Rooms
  socket.on('get_public_rooms', () => {
     const publicRooms = [];
     for (const [code, room] of rooms.entries()) {
        if (room.phase === 'LOBBY' && room.players.length < 10) {
           publicRooms.push({
              roomCode: code,
              hostName: room.getHost()?.name || 'Unknown',
              playerCount: room.players.length
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
             if (room.players.length === 0) {
                 rooms.delete(code);
             } else {
                 if (player.isHost) {
                     room.players[0].isHost = true;
                 }
                 broadcastGameState(room, io);
             }
         } else {
             // Let them stay in the game state, they can reconnect by refreshing.
             broadcastGameState(room, io);
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
