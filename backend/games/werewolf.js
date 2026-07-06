const crypto = require('crypto');
const { BaseRoom } = require('../Room');

// Werewolf (Mafia) game logic. Extends BaseRoom, which provides the generic
// room concerns (players, host, chat, settings). Everything below is
// Werewolf-specific: phases, roles, the sequential night engine, voting,
// deaths, win conditions, and the per-player redacted getState().
class WerewolfGame extends BaseRoom {
  constructor(roomCode) {
    super(roomCode, 'werewolf');
    this.phase = 'LOBBY'; // LOBBY, ROLE_VIEW, NIGHT, NIGHT_WITCH, DAY, VOTING, HUNTER_REVENGE, END_GAME
    this.nightActions = { werewolf: [], seer: null, doctor: null };
    this.votes = new Map(); // voterId -> targetId
    this.winner = null; // 'WEREWOLVES' | 'VILLAGERS' | 'FOOL' | 'LOVERS'
    this.lastNightKilled = null; // Array of player IDs killed last night
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
    this.dayNumber = 0; // Increments each night; drives the "Night N / Day N" HUD
    this.gameLog = []; // Public event history [{ id, text }] — no hidden role info
    this.lastVoteBreakdown = null; // Who voted whom in the most recent vote
    // Sequential night: roles act one at a time in a fixed order
    this.nightQueue = []; // ordered role steps for the current night
    this.nightStepIndex = 0;
    this.currentNightRole = null; // the role acting right now (public, for atmosphere)
    this.nightWerewolfVictim = undefined; // precomputed for the witch step
  }

  addLog(text) {
    this.gameLog.push({ id: `${this.dayNumber}-${this.gameLog.length}`, text });
    if (this.gameLog.length > 100) this.gameLog.shift();
  }

  logNightSummary() {
    const names = (this.lastNightKilled || [])
      .map(id => this.getPlayer(id)?.name)
      .filter(Boolean);
    if (names.length > 0) {
      this.addLog(`🌙 คืนที่ ${this.dayNumber}: ${names.join(', ')} เสียชีวิต`);
    } else {
      this.addLog(`🌙 คืนที่ ${this.dayNumber}: คืนอันเงียบสงบ ไม่มีใครเสียชีวิต`);
    }
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
    this.dayNumber = 0;
    this.gameLog = [];
    this.lastVoteBreakdown = null;
    this.nightQueue = [];
    this.nightStepIndex = 0;
    this.currentNightRole = null;
    this.pendingHunter = null;
    this.hunterTargetPhase = null;
    this.pendingWitchKill = null;
    this.nightWerewolfVictim = undefined;
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
    const enteringNight = newPhase === 'NIGHT' && this.phase !== 'NIGHT';
    this.phase = newPhase;
    if (newPhase === 'NIGHT') {
      if (enteringNight) this.dayNumber += 1;
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
    // Only the role whose step is active may act
    if (player.role !== this.currentNightRole) return null;
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

  // ---- Sequential night engine ----
  // Roles act one at a time in this order. Only present & relevant roles are queued.
  buildNightQueue() {
    const alive = this.getAlivePlayers();
    const present = (role) => alive.some(p => p.role === role);
    const queue = [];
    if (present('Cupid') && this.lovers.length < 2) queue.push('Cupid');
    if (present('Werewolf')) queue.push('Werewolf');
    if (present('Seer')) queue.push('Seer');
    if (present('Doctor')) queue.push('Doctor');
    if (present('Witch') && (this.witchPotions.heal || this.witchPotions.poison)) queue.push('Witch');
    return queue;
  }

  beginNight() {
    this.setPhase('NIGHT'); // increments dayNumber, resets nightActions + hasActed
    this.nightWerewolfVictim = undefined;
    this.pendingWitchKill = null;
    this.nightQueue = this.buildNightQueue();
    this.nightStepIndex = 0;
    this.startNightStep();
  }

  startNightStep() {
    // No more steps → apply the night's results and move to day
    if (this.nightStepIndex >= this.nightQueue.length) {
      this.finalizeNight();
      return;
    }
    const role = this.nightQueue[this.nightStepIndex];
    this.currentNightRole = role;
    // Reset the acting flag only for this role's players
    this.players.forEach(p => { if (p.role === role) p.hasActed = false; });

    if (role === 'Witch') {
      // The witch must see who the werewolves are about to kill (after the doctor's save)
      this.nightWerewolfVictim = this.computeWerewolfVictim();
      this.pendingWitchKill = this.nightWerewolfVictim;
      this.nightActions.witchHeal = false;
      this.nightActions.witchPoison = null;
      this.phase = 'NIGHT_WITCH';
    } else {
      this.phase = 'NIGHT';
    }
  }

  checkStepEnd() {
    const actors = this.getAlivePlayers().filter(p => p.role === this.currentNightRole);
    return actors.length > 0 && actors.every(p => p.hasActed);
  }

  advanceNightStep() {
    this.nightStepIndex += 1;
    this.startNightStep();
  }

  computeWerewolfVictim() {
    const counts = {};
    let victim = null;
    let max = 0;
    this.nightActions.werewolf.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > max) { max = counts[id]; victim = id; }
    });
    if (victim && this.nightActions.doctor === victim) victim = null; // doctor save
    return victim;
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
    return true; // advancing is driven by the server via checkStepEnd
  }

  finalizeNight() {
    this.currentNightRole = null;

    // Assign lovers first, so a same-night death triggers the partner's suicide
    if (this.nightActions.cupid && this.nightActions.cupid.length === 2) {
      this.lovers = this.nightActions.cupid;
      this.cupidActed = true;
    }

    // Werewolf victim: reuse the value computed for the witch step, else compute now
    let victim = this.nightWerewolfVictim !== undefined ? this.nightWerewolfVictim : this.computeWerewolfVictim();
    if (this.nightActions.witchHeal) victim = null; // witch's heal cancels the kill

    this.lastNightKilled = [];
    if (victim) this.killPlayer(victim, 'NIGHT');
    if (this.nightActions.witchPoison) this.killPlayer(this.nightActions.witchPoison, 'NIGHT');

    this.pendingWitchKill = null;
    this.nightWerewolfVictim = undefined;

    if (this.phase !== 'HUNTER_REVENGE') {
      this.setPhase('DAY');
    }
  }

  handleHunterAction(targetId) {
    if (this.phase !== 'HUNTER_REVENGE' || !this.pendingHunter) return false;

    if (targetId) {
        this.killPlayer(targetId, 'HUNTER_REVENGE');
    }

    const next = this.hunterTargetPhase || 'DAY';
    this.pendingHunter = null;
    this.hunterTargetPhase = null;
    // Returning to night must rebuild the step queue, not just flip the phase
    if (next === 'NIGHT') {
      this.beginNight();
    } else {
      this.setPhase(next);
    }
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
    // Record who voted for whom so the result can be revealed publicly.
    this.lastVoteBreakdown = Array.from(this.votes.entries()).map(([voterId, targetId]) => ({
        voter: this.getPlayer(voterId)?.name || 'ผู้เล่น',
        target: this.getPlayer(targetId)?.name || 'ผู้เล่น'
    }));

    if (this.votes.size === 0) {
      this.addLog(`☀️ วันที่ ${this.dayNumber}: ทุกคนงดออกเสียง ไม่มีใครถูกโหวตออก`);
      return null; // everyone skipped
    }

    // Tally all votes first, then find the top candidate. Doing it in a single
    // order-dependent pass mis-detects ties, so count fully before deciding.
    const counts = {};
    for (const targetId of this.votes.values()) {
        counts[targetId] = (counts[targetId] || 0) + 1;
    }

    const maxCount = Math.max(...Object.values(counts));
    const topCandidates = Object.keys(counts).filter(id => counts[id] === maxCount);

    const breakdownText = this.lastVoteBreakdown.map(v => `   ${v.voter} → ${v.target}`).join('\n');

    // A tie (more than one player at the top) means no one is eliminated.
    if (topCandidates.length === 1) {
        this.killPlayer(topCandidates[0], 'VOTING');
        const name = this.getPlayer(topCandidates[0])?.name || 'ผู้เล่น';
        this.addLog(`☀️ วันที่ ${this.dayNumber}: โหวตออก ${name}\n${breakdownText}`);
        return topCandidates[0];
    }
    this.addLog(`☀️ วันที่ ${this.dayNumber}: คะแนนเสมอ ไม่มีใครถูกโหวตออก\n${breakdownText}`);
    return null;
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
      this.dayNumber = 0;
      this.gameLog = [];
      this.lastVoteBreakdown = null;
      this.nightQueue = [];
      this.nightStepIndex = 0;
      this.currentNightRole = null;
      this.lovers = [];
      this.cupidActed = false;
      this.witchPotions = { heal: true, poison: true };
      this.players.forEach(p => {
          p.role = null;
          p.isAlive = true;
          p.hasVoted = false;
          p.hasActed = false;
      });
  }

  // ── Game interface (called by the generic server via ctx) ──

  // After startGame(): show roles for 5s, then begin the first night.
  onStart(ctx) {
    ctx.after(5000, () => {
      if (this.phase === 'ROLE_VIEW') {
        this.beginNight();
        this.transition(ctx);
      }
    });
  }

  // A game action arrived from a player. Route by event name.
  handleEvent(event, player, payload, ctx) {
    switch (event) {
      case 'start_voting': {
        if (!player?.isHost || this.phase !== 'DAY') return;
        const winner = this.checkWinCondition();
        if (winner) {
          this.setPhase('END_GAME');
          this.winner = winner;
          ctx.broadcast();
          return;
        }
        this.setPhase('VOTING');
        ctx.broadcast();
        ctx.startTimer();
        return;
      }

      case 'night_action': {
        if (this.phase !== 'NIGHT' || !player || !player.isAlive) return;
        const result = this.handleNightAction(player, payload.targetId);
        if (player.role === 'Seer' && result) ctx.emitPlayer(player.id, 'seer_result', result);
        if (this.checkStepEnd()) {
          ctx.stopTimer();
          this.advanceNightStep();
          this.continueNight(ctx);
        } else {
          ctx.broadcast();
        }
        return;
      }

      case 'witch_action': {
        if (this.phase !== 'NIGHT_WITCH' || !player || !player.isAlive || player.role !== 'Witch') return;
        const ok = this.handleNightWitchAction(player, payload.action);
        if (ok && this.checkStepEnd()) {
          ctx.stopTimer();
          this.advanceNightStep();
          this.continueNight(ctx);
        } else {
          ctx.broadcast();
        }
        return;
      }

      case 'hunter_action': {
        if (this.phase !== 'HUNTER_REVENGE' || !player || player.id !== this.pendingHunter) return;
        ctx.stopTimer();
        this.handleHunterAction(payload.targetId);
        this.transition(ctx);
        return;
      }

      case 'vote': {
        if (this.phase !== 'VOTING' || !player || !player.isAlive) return;
        this.handleVote(player.id, payload.targetId);
        if (this.checkVotingEnd()) {
          ctx.stopTimer();
          this.resolveVoting();
          this.startNextNightOrEnd();
          this.transition(ctx);
        } else {
          ctx.broadcast();
        }
        return;
      }

      default:
        return;
    }
  }

  // The phase/step countdown hit zero — force progress.
  onTimerExpire(ctx) {
    if (this.phase === 'NIGHT' || this.phase === 'NIGHT_WITCH') {
      this.advanceNightStep();
      this.continueNight(ctx);
    } else if (this.phase === 'VOTING') {
      this.resolveVoting();
      this.startNextNightOrEnd();
      this.transition(ctx);
    } else if (this.phase === 'HUNTER_REVENGE') {
      this.handleHunterAction(null); // didn't shoot in time — skip
      this.transition(ctx);
    }
  }

  // After a night step completes: run the next step, or finish into day.
  continueNight(ctx) {
    if (this.phase === 'NIGHT' || this.phase === 'NIGHT_WITCH') {
      ctx.broadcast();
      ctx.startTimer();
    } else {
      this.transition(ctx);
    }
  }

  // After voting: end on a win, otherwise start the next night.
  startNextNightOrEnd() {
    if (this.phase === 'HUNTER_REVENGE') return; // hunter interrupt routes itself
    const winner = this.checkWinCondition();
    if (winner) {
      this.setPhase('END_GAME');
      this.winner = winner;
    } else {
      this.beginNight();
    }
  }

  // Central phase-transition: win check, announce deaths, arm the next timer.
  transition(ctx) {
    // DAY (discussion) and END_GAME have no countdown — clear any leftover bar.
    if (this.phase === 'DAY' || this.phase === 'END_GAME') {
      ctx.stopTimer();
    }

    if (this.phase === 'HUNTER_REVENGE') {
      ctx.startTimer();
    } else if (this.phase === 'NIGHT_WITCH') {
      ctx.startTimer();
    } else if (this.phase === 'DAY') {
      const winner = this.checkWinCondition();
      if (winner) {
        this.logNightSummary();
        this.setPhase('END_GAME');
        this.winner = winner;
      } else {
        this.logNightSummary();
        ctx.emitRoom('night_result', this.lastNightKilled || []);
        // 15s discussion, then voting (unless the host opened it early)
        ctx.after(15000, () => {
          if (this.phase === 'DAY') {
            this.setPhase('VOTING');
            ctx.startTimer();
            ctx.broadcast();
          }
        });
      }
    } else if (this.phase === 'NIGHT') {
      ctx.startTimer();
    }
    ctx.broadcast();
  }

  // Chat channel rules (overrides the plain BaseRoom default).
  buildChatMessage(sender, text, type) {
    let actualType = 'GLOBAL';
    if (!sender.isAlive) {
      actualType = 'DEAD';
    } else if (type === 'WEREWOLF' && sender.role === 'Werewolf') {
      actualType = 'WEREWOLF';
    }
    // Living players can't talk in the global channel during the night
    if (actualType === 'GLOBAL' && sender.isAlive && this.phase === 'NIGHT') {
      return null;
    }
    return {
      id: crypto.randomUUID(),
      senderId: sender.id,
      senderName: sender.name,
      text,
      type: actualType,
      timestamp: Date.now(),
    };
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

    // Progress counters. voteProgress uses the (public) alive count, so it is safe for all.
    // nightProgress.total = number of players in the acting role — that would leak e.g. the
    // werewolf count, so it is only sent to players who ARE that role (they already know it).
    const requester = this.getPlayer(playerId);
    const alive = this.getAlivePlayers();
    const isStepActor = this.currentNightRole && requester && requester.role === this.currentNightRole;
    let nightProgress = null;
    if (isStepActor) {
       const stepActors = alive.filter(p => p.role === this.currentNightRole);
       nightProgress = { done: stepActors.filter(p => p.hasActed).length, total: stepActors.length };
    }
    const voteProgress = { done: alive.filter(p => p.hasVoted).length, total: alive.length };

    return {
       gameType: this.gameType,
       roomCode: this.roomCode,
       phase: this.phase,
       players: safePlayers,
       winner: this.winner,
       settings: this.settings,
       messages: safeMessages,
       pendingHunter: this.pendingHunter,
       lovers: this.lovers,
       dayNumber: this.dayNumber,
       gameLog: this.gameLog,
       currentNightRole: this.currentNightRole,
       nightProgress,
       voteProgress,
       witchPotions: this.getPlayer(playerId)?.role === 'Witch' ? this.witchPotions : null,
       pendingWitchKill: this.getPlayer(playerId)?.role === 'Witch' ? this.pendingWitchKill : null
    };
  }
}

module.exports = { WerewolfGame };
