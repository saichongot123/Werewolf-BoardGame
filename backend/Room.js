// BaseRoom — the game-agnostic multiplayer room layer.
//
// It owns only concerns that EVERY game shares: player identity, the host,
// the chat log, and the shared timer setting. Each specific game (Werewolf,
// and future ones) subclasses this and adds its own phase machine, private
// state, and a getState(playerId) that decides what each player may see.
//
// ── Game interface ─────────────────────────────────────────────────────────
// server.js is fully game-agnostic. It owns the mechanism (sockets, rooms,
// timers) and hands each game a `ctx` object to drive it. A game subclass
// overrides the hooks below to implement its own rules. `ctx` provides:
//   ctx.broadcast()                       push getState() to every player
//   ctx.startTimer()                      start the countdown for this phase/step
//   ctx.stopTimer()                       stop it (clears the client's bar)
//   ctx.emitRoom(event, data)             emit to everyone in the room
//   ctx.emitPlayer(playerId, event, data) emit to one player's socket
//   ctx.after(ms, fn)                     delayed callback (phase timeouts)
//
// Hooks a game overrides:
//   startGame() -> boolean                begin the game (false if not ready)
//   onStart(ctx)                          after startGame(): kick off first phase
//   handleEvent(event, player, payload, ctx)  a game action arrived
//   onTimerExpire(ctx)                    the phase/step countdown hit zero
//   getState(playerId) -> obj             per-player snapshot (must include gameType, phase)
//   resetGame()                           return to LOBBY, keep players
//   buildChatMessage(sender, text, type)  -> msg | null (channel/visibility rules)
class BaseRoom {
  constructor(roomCode, gameType) {
    this.roomCode = roomCode;
    this.gameType = gameType;
    this.players = [];   // { id, socketId, name, isHost, ...game-specific fields }
    this.messages = [];  // chat: { id, senderId, senderName, text, type, timestamp }
    this.settings = { timer: 60 };
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

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  addMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > 100) this.messages.shift();
  }

  // ── Default game hooks (safe no-ops / plain behavior) ──
  // A game subclass overrides whichever it needs.
  startGame() { return false; }
  onStart(_ctx) {}
  handleEvent(_event, _player, _payload, _ctx) {}
  onTimerExpire(_ctx) {}
  resetGame() {}
  getState() { return { gameType: this.gameType, phase: 'LOBBY', players: this.players }; }

  // Default chat: one public channel, everyone sees everything.
  // Games with hidden channels (e.g. Werewolf) override this.
  buildChatMessage(sender, text) {
    return {
      id: `${Date.now()}-${Math.random()}`,
      senderId: sender.id,
      senderName: sender.name,
      text,
      type: 'GLOBAL',
      timestamp: Date.now(),
    };
  }
}

module.exports = { BaseRoom };
