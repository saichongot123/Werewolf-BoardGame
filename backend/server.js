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
const roomTimeLeft = {}; // roomCode -> current seconds remaining (for reconnect sync)

function startRoomTimer(roomCode, io) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (roomTimers[roomCode]) {
    clearInterval(roomTimers[roomCode]);
  }

  // Every phase/step uses the room's configured timer length.
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

      // Force transition if time is up
      if (room.phase === 'NIGHT' || room.phase === 'NIGHT_WITCH') {
        // Current role ran out of time — skip to the next night step
        room.advanceNightStep();
        continueNight(room, io);
      } else if (room.phase === 'VOTING') {
        room.resolveVoting();
        startNextNightOrEnd(room);
        processPhaseTransition(room, io);
      } else if (room.phase === 'HUNTER_REVENGE') {
        // Hunter didn't shoot in time — skip their revenge
        room.handleHunterAction(null);
        processPhaseTransition(room, io);
      }
    }
  }, 1000);
}

function stopRoomTimer(roomCode, io) {
  clearInterval(roomTimers[roomCode]);
  delete roomTimers[roomCode];
  delete roomTimeLeft[roomCode];
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
// After a night step completes: if more steps remain, run the next one;
// otherwise the night is over and we fall through to the day transition.
function continueNight(room, io) {
  if (room.phase === 'NIGHT' || room.phase === 'NIGHT_WITCH') {
    broadcastGameState(room, io);
    startRoomTimer(room.roomCode, io);
  } else {
    processPhaseTransition(room, io);
  }
}

// Shared post-voting routing: end the game on a win, otherwise start the next night.
function startNextNightOrEnd(room) {
  if (room.phase === 'HUNTER_REVENGE') return; // hunter interrupt handles its own routing
  const winner = room.checkWinCondition();
  if (winner) {
    room.setPhase('END_GAME');
    room.winner = winner;
  } else {
    room.beginNight();
  }
}

function processPhaseTransition(room, io) {
  // DAY (discussion) and END_GAME have no countdown — clear any leftover timer bar,
  // including the case where a night step or the vote expired straight into them.
  if (room.phase === 'DAY' || room.phase === 'END_GAME') {
    stopRoomTimer(room.roomCode, io);
  }
  if (room.phase === 'HUNTER_REVENGE') {
     // Hunter needs time to act, maybe start a timer?
     startRoomTimer(room.roomCode, io);
  } else if (room.phase === 'NIGHT_WITCH') {
     // Witch phase
     startRoomTimer(room.roomCode, io);
  } else if (room.phase === 'DAY') {
     const winner = room.checkWinCondition();
     if (winner) {
        room.logNightSummary();
        room.setPhase('END_GAME');
        room.winner = winner;
     } else {
        room.logNightSummary();
        // Broadcast who died during the night
        io.to(room.roomCode).emit('night_result', room.lastNightKilled || []);
        
        // Start discussion, then voting
        setTimeout(() => {
           if (room.phase === 'DAY') {
              room.setPhase('VOTING');
              startRoomTimer(room.roomCode, io);
              broadcastGameState(room, io);
           }
        }, 15000); // 15 seconds discussion
     }
  } else if (room.phase === 'NIGHT') {
     startRoomTimer(room.roomCode, io);
  }
  broadcastGameState(room, io);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Create Room
  socket.on('create_room', (playerName, callback) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode(); // avoid overwriting an existing room
    }
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

    if (room.players.length >= 10) {
      return callback({ success: false, message: 'Room is full (max 10 players)' });
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
    // Sync the running countdown so a refreshed client sees the timer immediately
    if (roomTimeLeft[code] != null) {
      socket.emit('timer_update', roomTimeLeft[code]);
    }
    broadcastGameState(room, io);
  });

  // 3. Start Game
  socket.on('start_game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id) {
      const success = room.startGame();
      if (success) {
        broadcastGameState(room, io);
        
        // After 5 seconds of role viewing, begin the first night (queued steps)
        setTimeout(() => {
          if (room.phase === 'ROLE_VIEW') {
             room.beginNight();
             processPhaseTransition(room, io);
          }
        }, 5000);
      } else {
        socket.emit('error_msg', 'Not enough players (Minimum 4 required).');
      }
    }
  });

  // 3.5 Start Voting (host opens the vote early, before the discussion timer runs out)
  socket.on('start_voting', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room && room.getHost()?.socketId === socket.id && room.phase === 'DAY') {
      const winner = room.checkWinCondition();
      if (winner) {
        room.setPhase('END_GAME');
        room.winner = winner;
        broadcastGameState(room, io);
        return;
      }
      room.setPhase('VOTING');
      broadcastGameState(room, io);
      startRoomTimer(roomCode, io);
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

      // Advance to the next role's step once everyone in this step has acted
      if (room.checkStepEnd()) {
        stopRoomTimer(roomCode, io);
        room.advanceNightStep();
        continueNight(room, io);
      } else {
        broadcastGameState(room, io);
      }
    }
  });

  // Night Action (Witch) — the witch is just the last night step
  socket.on('witch_action', ({ roomCode, action }) => {
    const room = rooms.get(roomCode);
    if (room && room.phase === 'NIGHT_WITCH') {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && player.isAlive && player.role === 'Witch') {
        const success = room.handleNightWitchAction(player, action);
        if (success && room.checkStepEnd()) {
          stopRoomTimer(roomCode, io);
          room.advanceNightStep();
          continueNight(room, io);
        } else {
          broadcastGameState(room, io);
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

      if (room.checkVotingEnd()) {
        stopRoomTimer(roomCode, io);
        room.resolveVoting();
        startNextNightOrEnd(room);
        processPhaseTransition(room, io);
      } else {
        broadcastGameState(room, io);
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

  // 10.5 Leave Room (voluntary exit back to the home screen)
  socket.on('leave_room', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const wasHost = player.isHost;
    room.removePlayer(player.id);
    socket.leave(roomCode);

    if (room.players.length === 0) {
      stopRoomTimer(roomCode, io);
      rooms.delete(roomCode);
    } else {
      if (wasHost) {
        room.players[0].isHost = true;
      }
      broadcastGameState(room, io);
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
