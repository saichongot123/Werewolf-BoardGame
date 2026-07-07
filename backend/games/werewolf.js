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
    // werewolf is a map (wolfId -> targetId) so wolves can see each other's picks
    // live and change their vote until the pack agrees on one victim.
    this.nightActions = { werewolf: {}, seer: null, doctor: null };
    this.lastDoctorProtect = null; // Doctor can't shield the same player two nights running
    this.votes = new Map(); // voterId -> targetId
    this.winner = null; // 'WEREWOLVES' | 'VILLAGERS' | 'FOOL' | 'LOVERS'
    this.lastNightKilled = null; // Array of player IDs killed last night
    this.settings = {
      timer: 60,
      enableFool: false,
      enableHunter: false,
      enableWitch: false,
      enableCupid: false,
      enableWolfCub: false
    };
    // Wolf Cub: a werewolf (role stays 'Werewolf', flagged p.isCub). When it dies,
    // the pack devours TWO victims the following night.
    this.wolfCubDied = false;   // armed on the cub's death, consumed at next beginNight
    this.wolfPickCount = 1;     // how many victims the wolves choose this night (1 or 2)
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
    this.nightWerewolfVictims = undefined; // precomputed for the witch step (array)
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
    this.nightActions = { werewolf: {}, seer: null, doctor: null };
    this.lastDoctorProtect = null;
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
    this.nightWerewolfVictims = undefined;
    this.wolfCubDied = false;
    this.wolfPickCount = 1;
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
      p.isCub = false;
    });

    // Wolf Cub replaces ONE regular werewolf (pack size unchanged) — it plays as a
    // werewolf but its death enrages the pack into a double kill next night.
    if (this.settings.enableWolfCub) {
      const oneWolf = this.players.find(p => p.role === 'Werewolf');
      if (oneWolf) oneWolf.isCub = true;
    }
  }

  setPhase(newPhase) {
    const enteringNight = newPhase === 'NIGHT' && this.phase !== 'NIGHT';
    this.phase = newPhase;
    if (newPhase === 'NIGHT') {
      if (enteringNight) this.dayNumber += 1;
      this.nightActions = { werewolf: {}, seer: null, doctor: null, cupid: [] };
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

      // Wolf Cub's death (by any cause) enrages the pack: two victims next night.
      if (player.isCub) {
          this.wolfCubDied = true;
          this.addLog('🐺 ลูกหมาป่าถูกฆ่า! ฝูงหมาป่าคลั่งแค้น — คืนถัดไปจะคร่าชีวิต 2 คน');
      }

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
      // A pick is an array of exactly wolfPickCount targets (1 normally, 2 on a
      // Wolf-Cub-rage night). Reject wrong count, duplicates, or targeting the pack.
      const want = this.wolfPickCount || 1;
      const ids = Array.isArray(targetId) ? targetId : [targetId];
      if (ids.length !== want) return null;
      if (new Set(ids).size !== ids.length) return null;
      for (const id of ids) {
        const t = this.getPlayer(id);
        if (!t || !t.isAlive || t.role === 'Werewolf') return null;
      }
      // Record this wolf's pick (overwrites a previous one — they may change their
      // vote freely until the whole pack agrees). Step ends on unanimity.
      this.nightActions.werewolf[player.id] = ids;
      player.hasActed = true;
    } else if (player.role === 'Seer') {
      this.nightActions.seer = targetId;
      player.hasActed = true;
      const target = this.getPlayer(targetId);
      return { targetId, role: target ? target.role : 'Unknown' };
    } else if (player.role === 'Doctor') {
      // Can't protect the same player two nights in a row.
      if (targetId && targetId === this.lastDoctorProtect) return null;
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
    this.nightWerewolfVictims = undefined;
    this.pendingWitchKill = null;
    // If the Wolf Cub died, the pack devours two this night (capped by how many
    // non-wolf targets are actually alive). Consume the flag — it's a one-night rage.
    const preyAlive = this.getAlivePlayers().filter(p => p.role !== 'Werewolf').length;
    this.wolfPickCount = Math.min(this.wolfCubDied ? 2 : 1, Math.max(1, preyAlive));
    this.wolfCubDied = false;
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
      this.nightWerewolfVictims = this.computeWerewolfVictims();
      this.pendingWitchKill = this.nightWerewolfVictims[0] || null;
      this.nightActions.witchHeal = false;
      this.nightActions.witchPoison = null;
      this.phase = 'NIGHT_WITCH';
    } else {
      this.phase = 'NIGHT';
    }
  }

  // A wolf's pick is stored as an array (length = wolfPickCount) so the same code
  // handles the normal 1-victim night and the Wolf-Cub-rage 2-victim night.
  _wolfPickKey(pick) {
    return Array.isArray(pick) ? [...pick].sort().join('|') : String(pick);
  }

  checkStepEnd() {
    const actors = this.getAlivePlayers().filter(p => p.role === this.currentNightRole);
    if (actors.length === 0) return false;
    // Werewolves resolve only once the whole pack points at the SAME victim(s)
    // (they coordinate via the live vote board). If they can't agree, the step
    // timer expires and computeWerewolfVictims falls back to a majority/random pick.
    if (this.currentNightRole === 'Werewolf') {
      const picks = actors.map(p => this.nightActions.werewolf[p.id]);
      if (picks.some(t => t == null)) return false;
      const first = this._wolfPickKey(picks[0]);
      return picks.every(t => this._wolfPickKey(t) === first);
    }
    return actors.every(p => p.hasActed);
  }

  advanceNightStep() {
    this.nightStepIndex += 1;
    this.startNightStep();
  }

  // Returns the array of werewolf victims (1 or 2), after the doctor's save. Tallies
  // every wolf's pick(s); on a tie (e.g. timer expired) chooses randomly among the
  // top targets, so the outcome never depends on who clicked first.
  computeWerewolfVictims() {
    const counts = {};
    Object.values(this.nightActions.werewolf).forEach(pick => {
      if (!pick) return;
      (Array.isArray(pick) ? pick : [pick]).forEach(id => {
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
    });
    // Order targets by votes desc, breaking ties randomly, then take the top N.
    const ordered = Object.keys(counts)
      .map(id => ({ id, c: counts[id], r: Math.random() }))
      .sort((a, b) => (b.c - a.c) || (a.r - b.r))
      .map(x => x.id);
    let victims = ordered.slice(0, this.wolfPickCount || 1);
    if (this.nightActions.doctor) victims = victims.filter(id => id !== this.nightActions.doctor); // doctor save
    return victims;
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

    // Remember who the doctor shielded so they can't repeat it next night.
    this.lastDoctorProtect = this.nightActions.doctor || null;

    // Assign lovers first, so a same-night death triggers the partner's suicide
    if (this.nightActions.cupid && this.nightActions.cupid.length === 2) {
      this.lovers = this.nightActions.cupid;
      this.cupidActed = true;
    }

    // Werewolf victims: reuse the array computed for the witch step, else compute now
    let victims = this.nightWerewolfVictims !== undefined ? this.nightWerewolfVictims : this.computeWerewolfVictims();
    if (this.nightActions.witchHeal) victims = victims.slice(1); // heal saves the primary victim

    this.lastNightKilled = [];
    victims.forEach(v => { if (v) this.killPlayer(v, 'NIGHT'); });
    if (this.nightActions.witchPoison) this.killPlayer(this.nightActions.witchPoison, 'NIGHT');

    this.pendingWitchKill = null;
    this.nightWerewolfVictims = undefined;

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
      this.lastDoctorProtect = null;
      this.wolfCubDied = false;
      this.wolfPickCount = 1;
      this.players.forEach(p => {
          p.role = null;
          p.isAlive = true;
          p.hasVoted = false;
          p.hasActed = false;
          p.isCub = false;
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
      case 'game_action': {
        // Generic channel — used for lobby bot management.
        if (payload?.type === 'add_bot') return this.handleAddBot(player, ctx);
        if (payload?.type === 'remove_bot') return this.handleRemoveBot(player, ctx);
        return;
      }

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
        this.scheduleBots(ctx);
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
      this.scheduleBots(ctx);
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
            this.scheduleBots(ctx);
          }
        });
      }
    } else if (this.phase === 'NIGHT') {
      ctx.startTimer();
    }
    ctx.broadcast();
    this.scheduleBots(ctx);
  }

  // ── Bots (for solo playtesting) ──
  // Bots are lobby-added players with socketId=null. They take valid automatic
  // actions in every phase so a single human can run a whole game.
  handleAddBot(player, ctx) {
    if (this.phase !== 'LOBBY' || !player?.isHost || this.players.length >= (this.maxPlayers || 10)) return;
    const n = this.players.filter(p => p.isBot).length + 1;
    this.addPlayer({
      id: crypto.randomUUID(), socketId: null, name: `🤖 บอท ${n}`,
      isHost: false, isBot: true, role: null, isAlive: true,
    });
    ctx.broadcast();
  }
  handleRemoveBot(player, ctx) {
    if (this.phase !== 'LOBBY' || !player?.isHost) return;
    const bot = [...this.players].reverse().find(p => p.isBot);
    if (bot) { this.removePlayer(bot.id); ctx.broadcast(); }
  }

  // Small helpers for bot choices
  _randOf(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }

  // After any phase/step settles, give humans a beat, then let bots act.
  scheduleBots(ctx) {
    if (!this.players.some(p => p.isBot && p.isAlive)) return;
    if (!['NIGHT', 'NIGHT_WITCH', 'VOTING', 'HUNTER_REVENGE'].includes(this.phase)) return;
    ctx.after(1200, () => this.botAct(ctx));
  }

  botAct(ctx) {
    const alive = this.getAlivePlayers();

    if (this.phase === 'NIGHT') {
      const role = this.currentNightRole;
      const bots = alive.filter(p => p.isBot && p.role === role);
      if (bots.length === 0) return; // this step is a human's — nothing to do

      if (role === 'Werewolf') {
        // All bot wolves back the SAME set of victims so the pack reaches unanimity
        // (a human wolf, if any, sees this on the live board and can match). Picks
        // wolfPickCount targets — 2 on a Wolf-Cub-rage night.
        const prey = alive.filter(p => p.role !== 'Werewolf').map(p => p.id);
        const want = this.wolfPickCount || 1;
        const shuffled = [...prey].sort(() => Math.random() - 0.5).slice(0, want);
        if (shuffled.length === want) bots.forEach(w => this.handleNightAction(w, shuffled));
      } else if (role === 'Seer') {
        bots.forEach(s => {
          const t = this._randOf(alive.filter(p => p.id !== s.id));
          if (t) this.handleNightAction(s, t.id);
        });
      } else if (role === 'Doctor') {
        bots.forEach(d => {
          const t = this._randOf(alive.filter(p => p.id !== this.lastDoctorProtect));
          if (t) this.handleNightAction(d, t.id);
        });
      } else if (role === 'Cupid') {
        bots.forEach(c => {
          const pool = alive.map(p => p.id);
          const a = this._randOf(pool);
          const b = this._randOf(pool.filter(id => id !== a));
          if (a && b) this.handleNightAction(c, [a, b]);
        });
      }

      if (this.checkStepEnd()) {
        ctx.stopTimer();
        this.advanceNightStep();
        this.continueNight(ctx);
      } else {
        ctx.broadcast();
      }
      return;
    }

    if (this.phase === 'NIGHT_WITCH') {
      const witch = alive.find(p => p.isBot && p.role === 'Witch');
      if (!witch || witch.hasActed) return;
      const action = {};
      // Heal a threatened victim ~60% of the time; rarely poison at random.
      if (this.pendingWitchKill && this.witchPotions.heal && Math.random() < 0.6) action.heal = true;
      if (this.witchPotions.poison && Math.random() < 0.15) {
        const t = this._randOf(alive.filter(p => p.id !== witch.id));
        if (t) action.poison = t.id;
      }
      this.handleNightWitchAction(witch, action);
      if (this.checkStepEnd()) {
        ctx.stopTimer();
        this.advanceNightStep();
        this.continueNight(ctx);
      } else {
        ctx.broadcast();
      }
      return;
    }

    if (this.phase === 'VOTING') {
      alive.filter(p => p.isBot && !p.hasVoted).forEach(b => {
        // Wolves avoid lynching their own pack; everyone else votes at random.
        const pool = alive.filter(p => p.id !== b.id &&
          !(b.role === 'Werewolf' && p.role === 'Werewolf'));
        const t = this._randOf(pool);
        this.handleVote(b.id, t ? t.id : null);
      });
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

    if (this.phase === 'HUNTER_REVENGE') {
      const hunter = this.getPlayer(this.pendingHunter);
      if (!hunter || !hunter.isBot) return;
      const t = this._randOf(alive.filter(p => p.id !== hunter.id));
      this.handleHunterAction(t ? t.id : null);
      this.transition(ctx);
      return;
    }
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

  // Public role lineup for the game (counts only — never who is what). Shown so
  // everyone knows what they're playing with. In LOBBY it's a preview from the
  // host's settings + current headcount; once the game starts it counts the real
  // assigned roles (the Wolf Cub is listed apart from plain werewolves).
  getRoleSetup() {
    const order = ['Werewolf', 'WolfCub', 'Seer', 'Doctor', 'Witch', 'Cupid', 'Hunter', 'Fool', 'Villager'];
    const counts = {};
    if (this.phase === 'LOBBY') {
      const n = this.players.length;
      let w = Math.max(1, Math.floor(n / 3));
      if (this.settings.enableWolfCub && w >= 1) { counts.WolfCub = 1; w -= 1; }
      if (w > 0) counts.Werewolf = w;
      counts.Seer = 1; counts.Doctor = 1;
      if (this.settings.enableFool) counts.Fool = 1;
      if (this.settings.enableHunter) counts.Hunter = 1;
      if (this.settings.enableWitch) counts.Witch = 1;
      if (this.settings.enableCupid) counts.Cupid = 1;
      const used = Object.values(counts).reduce((s, c) => s + c, 0);
      const villagers = n - used;
      if (villagers > 0) counts.Villager = villagers;
    } else {
      this.players.forEach(p => {
        const key = p.isCub ? 'WolfCub' : p.role;
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    }
    return order.filter(r => counts[r]).map(r => ({ role: r, count: counts[r] }));
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

       // Reveal the Wolf-Cub flag only to the cub itself (and to everyone at game end).
       const revealCub = this.phase === 'END_GAME' || (playerId && p.id === playerId);

       return {
           id: p.id,
           name: p.name,
           isHost: p.isHost,
           isAlive: p.isAlive,
           hasVoted: p.hasVoted,
           hasActed: p.hasActed,
           role: displayRole,
           isCub: revealCub ? !!p.isCub : undefined
       };
    });

    let safeMessages = this.messages.filter(m => {
       const requestingPlayer = this.getPlayer(playerId);
       if (!requestingPlayer) return false;

       if (m.type === 'GLOBAL') return true;
       if (m.type === 'DEAD') return !requestingPlayer.isAlive;
       if (m.type === 'WEREWOLF') return requestingPlayer.role === 'Werewolf';
       return false;
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

    // Public, anonymous vote tally during the day vote: how many votes each target
    // has so far (NOT who cast them). Lets the table show who's being piled on.
    let voteTally = null;
    if (this.phase === 'VOTING') {
      voteTally = {};
      for (const targetId of this.votes.values()) {
        voteTally[targetId] = (voteTally[targetId] || 0) + 1;
      }
    }

    // Live werewolf vote board — only sent to a wolf during the wolf step, so the
    // pack can see each other's picks and converge on one victim.
    let werewolfVotes = null;
    if (this.currentNightRole === 'Werewolf' && requester && requester.role === 'Werewolf') {
       werewolfVotes = alive.filter(p => p.role === 'Werewolf').map(p => {
          const pick = this.nightActions.werewolf[p.id]; // array or undefined
          const ids = Array.isArray(pick) ? pick : [];
          return {
             voterId: p.id,
             voterName: p.name,
             targetNames: ids.map(id => this.getPlayer(id)?.name).filter(Boolean),
          };
       });
    }

    return {
       gameType: this.gameType,
       roomCode: this.roomCode,
       phase: this.phase,
       players: safePlayers,
       winner: this.winner,
       settings: this.settings,
       roleSetup: this.getRoleSetup(),
       maxPlayers: this.maxPlayers || 10,
       messages: safeMessages,
       pendingHunter: this.pendingHunter,
       lovers: this.lovers,
       dayNumber: this.dayNumber,
       gameLog: this.gameLog,
       currentNightRole: this.currentNightRole,
       nightProgress,
       voteProgress,
       voteTally,
       werewolfVotes,
       // How many victims the wolves pick this night (2 on a Wolf-Cub-rage night) —
       // sent to wolves so the table knows to select that many seats.
       wolfPickCount: requester?.role === 'Werewolf' ? this.wolfPickCount : 1,
       doctorLastProtect: requester?.role === 'Doctor' ? this.lastDoctorProtect : null,
       witchPotions: this.getPlayer(playerId)?.role === 'Witch' ? this.witchPotions : null,
       pendingWitchKill: this.getPlayer(playerId)?.role === 'Witch' ? this.pendingWitchKill : null
    };
  }
}

module.exports = { WerewolfGame };
