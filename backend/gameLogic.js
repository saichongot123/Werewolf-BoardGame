class GameRoom {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.players = []; // Array of player objects
    this.phase = 'LOBBY'; // LOBBY, ROLE_VIEW, NIGHT, DAY, VOTING, END_GAME
    this.nightActions = { werewolf: [], seer: null, doctor: null }; 
    this.votes = new Map(); // voterId -> targetId
    this.winner = null; // 'WEREWOLVES' or 'VILLAGERS'
    this.lastNightKilled = null; // Array of player IDs killed last night
    this.messages = []; // Array of chat messages { id, senderId, senderName, text, type, timestamp }
    this.settings = {
      timer: 60,
      enableFool: false,
      enableHunter: false,
      enableWitch: false,
      enableCupid: false,
      enableLittleGirl: false
    };
    this.pendingHunter = null; // ID of the hunter who is taking revenge
    this.hunterTargetPhase = null; // Phase to return to after hunter takes revenge ('DAY' or 'NIGHT')
    this.lovers = []; // Array of two player IDs
    this.cupidActed = false; // Has cupid chosen lovers?
    this.witchPotions = { heal: true, poison: true };
  }

  addMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > 100) this.messages.shift();
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getHost() {
    return this.players.find(p => p.isHost);
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  startGame() {
    if (this.players.length < 4) return false;

    this.assignRoles();
    this.phase = 'ROLE_VIEW';
    this.nightActions = { werewolf: [], seer: null, doctor: null };
    this.votes.clear();
    this.winner = null;
    this.lastNightKilled = null;
    return true;
  }

  assignRoles() {
    const numPlayers = this.players.length;
    let numWerewolves = Math.floor(numPlayers / 3);
    if (numWerewolves < 1) numWerewolves = 1;

    let roles = [];
    for (let i = 0; i < numWerewolves; i++) roles.push('Werewolf');
    roles.push('Seer');
    roles.push('Doctor');

    if (this.settings.enableFool) roles.push('Fool');
    if (this.settings.enableHunter) roles.push('Hunter');
    if (this.settings.enableWitch) roles.push('Witch');
    if (this.settings.enableCupid) roles.push('Cupid');
    if (this.settings.enableLittleGirl) roles.push('LittleGirl');

    while (roles.length < numPlayers) {
      roles.push('Villager');
    }

    if (roles.length > numPlayers) {
      roles = roles.slice(0, numPlayers);
    }

    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // Assign to players
    this.players.forEach((p, i) => {
      p.role = roles[i];
      p.isAlive = true;
      p.hasVoted = false;
      p.hasActed = false; // For night actions
    });
  }

  setPhase(newPhase) {
    this.phase = newPhase;
    if (newPhase === 'NIGHT') {
      this.nightActions = { werewolf: [], seer: null, doctor: null, cupid: [] };
      this.players.forEach(p => p.hasActed = false);
    } else if (newPhase === 'VOTING') {
      this.votes.clear();
      this.players.forEach(p => p.hasVoted = false);
    }
  }

  killPlayer(playerId, deathPhase) {
      const player = this.getPlayer(playerId);
      if (!player || !player.isAlive) return false;

      player.isAlive = false;

      // Ensure lastNightKilled tracking if death happens during night or hunter revenge in morning
      if (deathPhase === 'NIGHT' || deathPhase === 'HUNTER_REVENGE') {
          this.lastNightKilled = this.lastNightKilled || [];
          if (!this.lastNightKilled.includes(playerId)) {
              this.lastNightKilled.push(playerId);
          }
      }

      if (player.role === 'Fool' && deathPhase === 'VOTING') {
          this.winner = 'FOOL';
      } else if (player.role === 'Hunter') {
          this.setPhase('HUNTER_REVENGE');
          this.pendingHunter = player.id;
          this.hunterTargetPhase = deathPhase === 'NIGHT' ? 'DAY' : 'NIGHT';
      }

      // Lovers suicide logic
      if (this.lovers.includes(playerId)) {
          const otherLoverId = this.lovers.find(id => id !== playerId);
          const otherLover = this.getPlayer(otherLoverId);
          if (otherLover && otherLover.isAlive) {
              // Note: Prevent infinite recursion if both die at same time, but isAlive check handles it.
              this.addMessage({
                  id: Date.now() + Math.random(),
                  type: 'GLOBAL',
                  text: `💔 ${otherLover.name} ตรอมใจตายตามคนรักไปแล้ว!`,
                  timestamp: new Date().toLocaleTimeString()
              });
              this.killPlayer(otherLoverId, deathPhase);
          }
      }

      return true;
  }

  handleNightAction(player, targetId) {
    if (player.role === 'Werewolf') {
      this.nightActions.werewolf.push(targetId);
      player.hasActed = true;
    } else if (player.role === 'Seer') {
      this.nightActions.seer = targetId;
      player.hasActed = true;
      const target = this.getPlayer(targetId);
      return { targetId, role: target ? target.role : 'Unknown' };
    } else if (player.role === 'Doctor') {
      this.nightActions.doctor = targetId;
      player.hasActed = true;
    } else if (player.role === 'Cupid') {
      if (!this.cupidActed && Array.isArray(targetId) && targetId.length === 2) {
         this.nightActions.cupid = targetId;
         player.hasActed = true;
      }
    }
    return null; // Return null for non-seer
  }

  checkNightEnd() {
    const alivePlayers = this.getAlivePlayers();
    
    const werewolves = alivePlayers.filter(p => p.role === 'Werewolf');
    const allWerewolvesActed = werewolves.every(p => p.hasActed);
    
    const seer = alivePlayers.find(p => p.role === 'Seer');
    const seerActed = !seer || seer.hasActed;

    const doctor = alivePlayers.find(p => p.role === 'Doctor');
    const doctorActed = !doctor || doctor.hasActed;

    const cupid = alivePlayers.find(p => p.role === 'Cupid');
    const cupidActedState = !cupid || this.cupidActed || cupid.hasActed;

    return allWerewolvesActed && seerActed && doctorActed && cupidActedState;
  }

  resolveNight() {
    // Determine who werewolves killed (most voted)
    let killedId = null;
    if (this.nightActions.werewolf.length > 0) {
       // Simple logic: first werewolf's target or majority
       // For simplicity in a basic app, if multiple werewolves, they might send different targets.
       // We'll take the most frequent target.
       const counts = {};
       let maxCount = 0;
       this.nightActions.werewolf.forEach(id => {
           counts[id] = (counts[id] || 0) + 1;
           if (counts[id] > maxCount) {
               maxCount = counts[id];
               killedId = id;
           }
       });
    }

    // Handle Cupid Lovers
    if (this.nightActions.cupid && this.nightActions.cupid.length === 2) {
       this.lovers = this.nightActions.cupid;
       this.cupidActed = true;
       // We should notify them in the chat privately, but for simplicity they will see their lover icon in UI
    }

    this.lastNightKilled = [];
    // Check doctor save
    let finalKilledId = null;
    if (killedId && this.nightActions.doctor !== killedId) {
        finalKilledId = killedId; // This person will die unless witch saves them
    }

    // Check if witch should act
    const witch = this.getAlivePlayers().find(p => p.role === 'Witch');
    if (witch && this.phase !== 'HUNTER_REVENGE' && (this.witchPotions.heal || this.witchPotions.poison)) {
        this.setPhase('NIGHT_WITCH');
        // Store the pending kill so witch can see it
        this.pendingWitchKill = finalKilledId;
        this.nightActions.witchHeal = false;
        this.nightActions.witchPoison = null;
        witch.hasActed = false;
    } else {
        if (finalKilledId) {
           this.killPlayer(finalKilledId, 'NIGHT');
        }
        // Only set to DAY if hunter isn't taking revenge
        if (this.phase !== 'HUNTER_REVENGE') {
           this.setPhase('DAY');
        }
    }
  }

  handleNightWitchAction(player, action) {
      if (player.role !== 'Witch' || this.phase !== 'NIGHT_WITCH') return false;
      
      if (action.heal && this.witchPotions.heal) {
          this.nightActions.witchHeal = true;
          this.witchPotions.heal = false;
      }
      if (action.poison && this.witchPotions.poison) {
          this.nightActions.witchPoison = action.poison; // targetId
          this.witchPotions.poison = false;
      }
      player.hasActed = true;
      
      // Resolve immediately after witch acts
      this.resolveNightWitch();
      return true;
  }

  resolveNightWitch() {
      // Handle the pending kill from werewolves
      if (this.pendingWitchKill && !this.nightActions.witchHeal) {
          this.killPlayer(this.pendingWitchKill, 'NIGHT');
      }

      // Handle witch poison
      if (this.nightActions.witchPoison) {
          this.killPlayer(this.nightActions.witchPoison, 'NIGHT');
      }

      this.pendingWitchKill = null;

      if (this.phase !== 'HUNTER_REVENGE') {
          this.setPhase('DAY');
      }
  }

  handleHunterAction(targetId) {
    if (this.phase !== 'HUNTER_REVENGE' || !this.pendingHunter) return false;
    
    if (targetId) {
        this.killPlayer(targetId, 'HUNTER_REVENGE');
    }
    
    this.setPhase(this.hunterTargetPhase || 'DAY');
    this.pendingHunter = null;
    this.hunterTargetPhase = null;
    return true;
  }

  handleVote(voterId, targetId) {
    const voter = this.getPlayer(voterId);
    if (!voter || !voter.isAlive) return;

    if (targetId) { // Can be null if skipped
       this.votes.set(voterId, targetId);
    }
    voter.hasVoted = true;
  }

  checkVotingEnd() {
    const alivePlayers = this.getAlivePlayers();
    return alivePlayers.every(p => p.hasVoted);
  }

  resolveVoting() {
    if (this.votes.size === 0) {
      return null; // everyone skipped
    }

    const counts = {};
    let maxCount = 0;
    let eliminatedId = null;
    let tie = false;

    for (let targetId of this.votes.values()) {
        counts[targetId] = (counts[targetId] || 0) + 1;
        if (counts[targetId] > maxCount) {
            maxCount = counts[targetId];
            eliminatedId = targetId;
            tie = false;
        } else if (counts[targetId] === maxCount) {
            tie = true;
        }
    }

    if (!tie && eliminatedId) {
        this.killPlayer(eliminatedId, 'VOTING');
        return eliminatedId;
    }
    return null; // Tie means no one dies
  }

  checkWinCondition() {
    if (this.winner === 'FOOL') return 'FOOL';

    const alive = this.getAlivePlayers();
    
    // Check lovers win
    if (alive.length === 2 && this.lovers.length === 2) {
       const isLover1Alive = alive.find(p => p.id === this.lovers[0]);
       const isLover2Alive = alive.find(p => p.id === this.lovers[1]);
       if (isLover1Alive && isLover2Alive) return 'LOVERS';
    }

    const werewolves = alive.filter(p => p.role === 'Werewolf').length;
    const villagers = alive.length - werewolves;

    if (werewolves === 0) return 'VILLAGERS';
    if (werewolves >= villagers) return 'WEREWOLVES';
    return null;
  }

  resetGame() {
      this.phase = 'LOBBY';
      this.winner = null;
      this.players.forEach(p => {
          p.role = null;
          p.isAlive = true;
          p.hasVoted = false;
          p.hasActed = false;
      });
  }

  // Returns state, selectively revealing roles based on who is asking
  getState(playerId = null) {
    const safePlayers = this.players.map(p => {
       const isEndGame = this.phase === 'END_GAME';
       
       let displayRole = null;
       if (isEndGame) {
           displayRole = p.role;
       } else if (playerId) {
           const requestingPlayer = this.getPlayer(playerId);
           if (requestingPlayer) {
               if (requestingPlayer.id === p.id) {
                   displayRole = p.role; // Player can see their own role
               } else if (requestingPlayer.role === 'Werewolf' && p.role === 'Werewolf') {
                   displayRole = 'Werewolf'; // Werewolves can see other Werewolves
               }
           }
       }

       return {
           id: p.id,
           name: p.name,
           isHost: p.isHost,
           isAlive: p.isAlive,
           hasVoted: p.hasVoted,
           hasActed: p.hasActed,
           role: displayRole 
       };
    });

    let safeMessages = this.messages.filter(m => {
       const requestingPlayer = this.getPlayer(playerId);
       if (!requestingPlayer) return false;
       
       if (m.type === 'GLOBAL') return true;
       if (m.type === 'DEAD') return !requestingPlayer.isAlive;
       if (m.type === 'WEREWOLF') return requestingPlayer.role === 'Werewolf' || requestingPlayer.role === 'LittleGirl';
       return false;
    });

    safeMessages = safeMessages.map(m => {
        if (m.type === 'WEREWOLF') {
            const requestingPlayer = this.getPlayer(playerId);
            if (requestingPlayer && requestingPlayer.role === 'LittleGirl') {
                return { ...m, senderName: 'หมาป่า (นิรนาม)', senderId: 'anonymous' };
            }
        }
        return m;
    });

    return {
       roomCode: this.roomCode,
       phase: this.phase,
       players: safePlayers,
       winner: this.winner,
       settings: this.settings,
       messages: safeMessages,
       pendingHunter: this.pendingHunter,
       lovers: this.lovers,
       witchPotions: this.getPlayer(playerId)?.role === 'Witch' ? this.witchPotions : null,
       pendingWitchKill: this.getPlayer(playerId)?.role === 'Witch' ? this.pendingWitchKill : null
    };
  }
}

module.exports = { GameRoom };
