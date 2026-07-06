const crypto = require('crypto');
const { BaseRoom } = require('../../Room');
const { buildDeck, GOODS, LEGAL_GOODS } = require('./cards');
const { computeScores } = require('./scoring');

// Sheriff of Nottingham — full game module.
//
// Round loop, one "round" = one player's term as Sheriff:
//   MARKET     merchants discard/draw back up to a full hand
//   LOAD       merchants secretly bag 1–5 cards + declare a legal good (may lie)
//   INSPECTION Sheriff inspects or waves through each bag; merchants may bribe
//   RESOLVE    outcomes applied (fines, goods to stalls), shown briefly
//   → rotate Sheriff; after everyone has been Sheriff twice → SCORING
//
// Extends BaseRoom (players / host / chat / timer inherited). All actions arrive
// through the generic 'game_action' socket event and are dispatched by type.

const STARTING_GOLD = 50;
const HAND_SIZE = 6;
const MAX_BAG = 5;

class SheriffGame extends BaseRoom {
  constructor(roomCode) {
    super(roomCode, 'sheriff');
    this.phase = 'LOBBY';
    this.deck = [];
    this.discard = [];
    this.sheriffIndex = 0;
    this.round = 0;
    this.totalRounds = 0;
    this.lastResults = null; // filled at RESOLVE
    this.scores = null;      // filled at SCORING
    this.winner = null;
    this.log = [];           // public event history [{ id, text }]
  }

  // ── setup ──────────────────────────────────────────────────────────────
  startGame() {
    if (this.players.length < 3 || this.players.length > 6) return false;
    this.deck = shuffle(buildDeck());
    this.discard = [];
    this.players.forEach(p => {
      p.gold = STARTING_GOLD;
      p.hand = this.deck.splice(0, HAND_SIZE);
      p.stall = [];
      this.clearRoundState(p);
    });
    this.sheriffIndex = 0;
    this.round = 1;
    // Rulebook: each player is Sheriff twice — except a 6-player game, where each
    // is Sheriff once (keeps the game to a reasonable length).
    this.totalRounds = this.players.length === 6 ? 6 : this.players.length * 2;
    this.log = [];
    this.phase = 'MARKET';
    return true;
  }

  // Kick off the first phase after startGame(). Called by the server with ctx.
  onStart(ctx) {
    this.beginMarket(ctx);
  }

  resetGame() {
    this.phase = 'LOBBY';
    this.deck = [];
    this.discard = [];
    this.sheriffIndex = 0;
    this.round = 0;
    this.lastResults = null;
    this.scores = null;
    this.winner = null;
    this.log = [];
    this.players.forEach(p => {
      p.hand = [];
      p.stall = [];
      p.gold = 0;
      this.clearRoundState(p);
    });
  }

  clearRoundState(p) {
    p.ready = false;        // MARKET: done discarding/drawing
    p.bag = null;           // LOAD: { cards, declaredGood, declaredCount }
    p.bagSubmitted = false;
    p.bribe = null;         // INSPECTION: { gold }
    p.inspection = null;    // INSPECTION: { decision }
  }

  addLog(text) {
    this.log.push({ id: `${this.round}-${this.log.length}`, text });
    if (this.log.length > 60) this.log.shift();
  }

  // ── helpers ────────────────────────────────────────────────────────────
  getSheriff() { return this.players[this.sheriffIndex]; }
  getMerchants() {
    const s = this.getSheriff();
    return this.players.filter(p => p.id !== s.id);
  }
  isSheriff(player) { return player && player.id === this.getSheriff().id; }

  // What everyone may see of a player's stall: the legal goods (face-up) and how
  // many contraband cards are hidden (face-down), but not which contraband.
  publicStall(p) {
    const stall = p.stall || [];
    const legal = stall.filter(c => LEGAL_GOODS.includes(c));
    return { legal, contraband: stall.length - legal.length };
  }

  drawOne() {
    if (this.deck.length === 0) {
      if (this.discard.length === 0) return null;
      this.deck = shuffle(this.discard);
      this.discard = [];
    }
    return this.deck.pop();
  }
  refillHand(p) {
    while (p.hand.length < HAND_SIZE) {
      const c = this.drawOne();
      if (c == null) break;
      p.hand.push(c);
    }
  }

  // ── phase: MARKET ────────────────────────────────────────────────────────
  beginMarket(ctx) {
    this.phase = 'MARKET';
    this.lastResults = null;
    this.players.forEach(p => this.clearRoundState(p));
    this.addLog(`🎪 รอบ ${this.round}/${this.totalRounds} — นายอำเภอ: ${this.getSheriff().name}`);
    ctx.startTimer();
    ctx.broadcast();
    this.scheduleBots(ctx);
  }

  handleMarketReady(player, payload, ctx) {
    if (this.phase !== 'MARKET' || this.isSheriff(player) || player.ready) return;
    const discardIdx = Array.isArray(payload?.discard) ? payload.discard : [];
    // Remove the chosen cards (high→low so indices stay valid) into the discard pile.
    const idx = [...new Set(discardIdx)].filter(i => Number.isInteger(i) && i >= 0 && i < player.hand.length)
      .sort((a, b) => b - a);
    idx.forEach(i => this.discard.push(player.hand.splice(i, 1)[0]));
    this.refillHand(player);
    player.ready = true;
    if (this.getMerchants().every(p => p.ready)) this.beginLoad(ctx);
    else ctx.broadcast();
  }

  // ── phase: LOAD ────────────────────────────────────────────────────────
  beginLoad(ctx) {
    this.phase = 'LOAD';
    ctx.startTimer();
    ctx.broadcast();
    this.scheduleBots(ctx);
  }

  handleLoadBag(player, payload, ctx) {
    if (this.phase !== 'LOAD' || this.isSheriff(player) || player.bagSubmitted) return;
    const raw = Array.isArray(payload?.cardIndices) ? payload.cardIndices : [];
    const declaredGood = payload?.declaredGood;
    if (!LEGAL_GOODS.includes(declaredGood)) return;
    const idx = [...new Set(raw)].filter(i => Number.isInteger(i) && i >= 0 && i < player.hand.length);
    if (idx.length < 1 || idx.length > MAX_BAG) return;

    const cards = idx.map(i => player.hand[i]);
    idx.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
    player.bag = { cards, declaredGood, declaredCount: cards.length };
    player.bagSubmitted = true;
    this.addLog(`📦 ${player.name} ประกาศ "${cards.length} ${GOODS[declaredGood].name}"`);
    if (this.getMerchants().every(p => p.bagSubmitted)) this.beginInspection(ctx);
    else ctx.broadcast();
  }

  // ── phase: INSPECTION ────────────────────────────────────────────────────
  beginInspection(ctx) {
    this.phase = 'INSPECTION';
    ctx.startTimer();
    ctx.broadcast();
    this.scheduleBots(ctx);
  }

  handleOfferBribe(player, payload, ctx) {
    if (this.phase !== 'INSPECTION' || this.isSheriff(player) || !player.bag || player.inspection) return;
    const gold = Math.max(0, Math.min(Math.floor(payload?.gold || 0), player.gold));
    player.bribe = gold > 0 ? { gold } : null;
    ctx.broadcast();
  }

  handleInspectDecision(player, payload, ctx) {
    if (this.phase !== 'INSPECTION' || !this.isSheriff(player)) return;
    const target = this.getMerchants().find(p => p.id === payload?.targetId);
    if (!target || !target.bag || target.inspection) return;
    let decision = payload?.decision;
    if (!['inspect', 'pass', 'accept_bribe'].includes(decision)) return;
    if (decision === 'accept_bribe' && !target.bribe) decision = 'pass';
    target.inspection = { decision };
    if (this.getMerchants().every(p => p.inspection)) this.resolveRound(ctx);
    else ctx.broadcast();
  }

  // ── phase: RESOLVE ────────────────────────────────────────────────────────
  resolveRound(ctx) {
    ctx.stopTimer();
    const sheriff = this.getSheriff();
    const results = [];

    for (const m of this.getMerchants()) {
      const bag = m.bag;
      if (!bag) continue;
      const decision = m.inspection?.decision || 'pass';
      const r = {
        merchantId: m.id, name: m.name,
        declaredGood: bag.declaredGood, declaredCount: bag.declaredCount,
        cards: bag.cards.slice(), decision,
        honest: null, bribeGold: 0,
        merchantGold: 0, sheriffGold: 0,
        toStall: [], confiscated: [],
      };

      if (decision === 'inspect') {
        const matching = bag.cards.filter(c => c === bag.declaredGood);
        const mismatching = bag.cards.filter(c => c !== bag.declaredGood);
        r.honest = mismatching.length === 0;
        if (r.honest) {
          // Sheriff was wrong: pays the merchant each good's penalty; all goods pass.
          const fine = Math.min(
            bag.cards.reduce((s, c) => s + (GOODS[c]?.penalty || 0), 0),
            sheriff.gold
          );
          sheriff.gold -= fine; m.gold += fine;
          r.sheriffGold = -fine; r.merchantGold = fine;
          r.toStall = bag.cards.slice();
          m.stall.push(...bag.cards);
          this.addLog(`✅ ${m.name} พูดจริง! นายอำเภอจ่าย ${fine} ทอง`);
        } else {
          // Merchant lied: mismatches confiscated + fined; matches still pass.
          const fine = Math.min(
            mismatching.reduce((s, c) => s + (GOODS[c]?.penalty || 0), 0),
            m.gold
          );
          m.gold -= fine; sheriff.gold += fine;
          r.merchantGold = -fine; r.sheriffGold = fine;
          r.confiscated = mismatching.slice();
          r.toStall = matching.slice();
          this.discard.push(...mismatching);
          m.stall.push(...matching);
          this.addLog(`🚨 ${m.name} โกหก! จ่ายค่าปรับ ${fine} ทอง (ยึด ${mismatching.length} ใบ)`);
        }
      } else {
        // pass or accept_bribe → everything goes to the stall, unchecked.
        if (decision === 'accept_bribe' && m.bribe) {
          const g = Math.min(m.bribe.gold, m.gold);
          m.gold -= g; sheriff.gold += g;
          r.bribeGold = g; r.merchantGold = -g; r.sheriffGold = g;
          this.addLog(`🤝 ${m.name} จ่ายสินบน ${g} ทอง — ผ่านด่าน`);
        } else {
          this.addLog(`👋 ${m.name} ผ่านด่านโดยไม่ถูกตรวจ`);
        }
        r.toStall = bag.cards.slice();
        m.stall.push(...bag.cards);
      }
      results.push(r);
    }

    this.lastResults = results;
    this.phase = 'RESOLVE';
    ctx.broadcast();
    // Auto-advance after a viewing pause; the Sheriff can also press continue.
    ctx.after(9000, () => { if (this.phase === 'RESOLVE') this.nextRoundOrEnd(ctx); });
  }

  handleContinue(player, ctx) {
    if (this.phase !== 'RESOLVE' || !this.isSheriff(player)) return;
    this.nextRoundOrEnd(ctx);
  }

  nextRoundOrEnd(ctx) {
    if (this.phase !== 'RESOLVE') return;
    this.players.forEach(p => this.clearRoundState(p));
    if (this.round >= this.totalRounds) {
      this.beginScoring(ctx);
    } else {
      this.round += 1;
      this.sheriffIndex = (this.sheriffIndex + 1) % this.players.length;
      this.beginMarket(ctx);
    }
  }

  // ── phase: SCORING ────────────────────────────────────────────────────────
  beginScoring(ctx) {
    ctx.stopTimer();
    this.scores = computeScores(this.players, GOODS, LEGAL_GOODS);
    this.winner = this.scores[0] || null;
    this.phase = 'SCORING';
    this.addLog(`🏆 จบเกม! ผู้ชนะ: ${this.winner?.name} (${this.winner?.total} แต้ม)`);
    ctx.broadcast();
  }

  // ── platform hooks ────────────────────────────────────────────────────────
  handleEvent(event, player, payload, ctx) {
    if (!player) return;
    const type = payload?.type;
    switch (type) {
      case 'market_ready':    return this.handleMarketReady(player, payload, ctx);
      case 'load_bag':        return this.handleLoadBag(player, payload, ctx);
      case 'offer_bribe':     return this.handleOfferBribe(player, payload, ctx);
      case 'inspect_decision':return this.handleInspectDecision(player, payload, ctx);
      case 'continue':        return this.handleContinue(player, ctx);
      case 'add_bot':         return this.handleAddBot(player, ctx);
      case 'remove_bot':      return this.handleRemoveBot(player, ctx);
      default: return;
    }
  }

  // ── bots ──────────────────────────────────────────────────────────────────
  // Bots are added in the lobby by the host and play automatically. They have
  // socketId=null so the server never tries to emit to them.
  handleAddBot(player, ctx) {
    if (this.phase !== 'LOBBY' || !player?.isHost || this.players.length >= 6) return;
    const n = this.players.filter(p => p.isBot).length + 1;
    this.addPlayer({ id: crypto.randomUUID(), socketId: null, name: `🤖 บอท ${n}`, isHost: false, isBot: true });
    ctx.broadcast();
  }
  handleRemoveBot(player, ctx) {
    if (this.phase !== 'LOBBY' || !player?.isHost) return;
    const bot = [...this.players].reverse().find(p => p.isBot);
    if (bot) { this.removePlayer(bot.id); ctx.broadcast(); }
  }

  // After a phase begins, give humans a beat, then let bots take their actions.
  scheduleBots(ctx) {
    if (!this.players.some(p => p.isBot)) return;
    ctx.after(900, () => this.botAct(ctx));
  }

  botAct(ctx) {
    if (this.phase === 'MARKET') {
      this.getMerchants().forEach(p => {
        if (p.isBot && !p.ready) this.handleMarketReady(p, { discard: [] }, ctx);
      });
    } else if (this.phase === 'LOAD') {
      this.getMerchants().forEach(p => {
        if (p.isBot && !p.bagSubmitted) this.handleLoadBag(p, this.botLoad(p), ctx);
      });
    } else if (this.phase === 'INSPECTION') {
      // Bot merchants may bribe when smuggling.
      this.getMerchants().forEach(p => {
        if (p.isBot && !p.inspection) {
          const g = this.botBribe(p);
          if (g > 0) this.handleOfferBribe(p, { gold: g }, ctx);
        }
      });
      // A bot Sheriff decides after a delay, so human merchants have time to bribe.
      if (this.getSheriff().isBot) {
        ctx.after(3000, () => {
          if (this.phase !== 'INSPECTION') return;
          const sheriff = this.getSheriff();
          this.getMerchants().forEach(p => {
            if (!p.inspection) this.handleInspectDecision(sheriff, { targetId: p.id, decision: this.botDecision(p) }, ctx);
          });
        });
      }
    }
  }

  // Pick cards + a legal declaration. ~45% of the time a bot smuggles contraband
  // and lies about it; otherwise it declares its most common legal good honestly.
  botLoad(p) {
    const hand = p.hand;
    const counts = {};
    LEGAL_GOODS.forEach(g => { counts[g] = 0; });
    hand.forEach(c => { if (LEGAL_GOODS.includes(c)) counts[c]++; });
    let declaredGood = 'apple', best = -1;
    for (const g of LEGAL_GOODS) if (counts[g] > best) { best = counts[g]; declaredGood = g; }

    const contrabandIdx = hand.map((c, i) => (LEGAL_GOODS.includes(c) ? -1 : i)).filter(i => i >= 0);
    const smuggle = contrabandIdx.length > 0 && Math.random() < 0.45;
    const idx = [];
    if (smuggle) {
      contrabandIdx.slice(0, 1 + Math.floor(Math.random() * 2)).forEach(i => idx.push(i)); // 1–2 contraband
      hand.forEach((c, i) => { if (c === declaredGood && idx.length < 3 && !idx.includes(i)) idx.push(i); });
    } else {
      hand.forEach((c, i) => { if (c === declaredGood && idx.length < 3) idx.push(i); });
    }
    if (idx.length === 0) idx.push(0); // fallback: bag the first card
    return { cardIndices: idx, declaredGood };
  }

  // Bribe roughly the risk (sum of contraband penalties) — but only sometimes.
  botBribe(p) {
    if (!p.bag) return 0;
    const contraband = p.bag.cards.filter(c => !LEGAL_GOODS.includes(c));
    if (contraband.length === 0 || Math.random() < 0.5) return 0;
    const risk = contraband.reduce((s, c) => s + (GOODS[c]?.penalty || 0), 0);
    return Math.min(p.gold, risk + 1);
  }

  // Bot Sheriff: take a decent bribe half the time; else inspect suspicious
  // (big) declarations more often than small ones.
  botDecision(p) {
    if (p.bribe && Math.random() < 0.5) return 'accept_bribe';
    const big = (p.bag?.declaredCount || 0) >= 3;
    return Math.random() < (big ? 0.6 : 0.3) ? 'inspect' : 'pass';
  }

  // Timer expired: force the current phase to resolve so no one can stall.
  onTimerExpire(ctx) {
    switch (this.phase) {
      case 'MARKET':
        this.getMerchants().forEach(p => { if (!p.ready) { this.refillHand(p); p.ready = true; } });
        return this.beginLoad(ctx);
      case 'LOAD':
        this.getMerchants().forEach(p => { if (!p.bagSubmitted) this.autoLoad(p); });
        return this.beginInspection(ctx);
      case 'INSPECTION':
        this.getMerchants().forEach(p => { if (!p.inspection) p.inspection = { decision: 'pass' }; });
        return this.resolveRound(ctx);
      case 'RESOLVE':
        return this.nextRoundOrEnd(ctx);
      default: return;
    }
  }

  // A merchant who didn't load in time gets one card auto-bagged, declared truthfully
  // if it's legal, otherwise declared as apples (a forced bluff).
  autoLoad(p) {
    if (p.hand.length === 0) { p.bag = { cards: [], declaredGood: 'apple', declaredCount: 0 }; p.bagSubmitted = true; return; }
    const card = p.hand.shift();
    const declaredGood = LEGAL_GOODS.includes(card) ? card : 'apple';
    p.bag = { cards: [card], declaredGood, declaredCount: 1 };
    p.bagSubmitted = true;
  }

  getState(playerId) {
    const sheriffId = this.getSheriff()?.id ?? null;
    const revealAll = this.phase === 'SCORING';
    return {
      gameType: this.gameType,
      roomCode: this.roomCode,
      phase: this.phase,
      round: this.round,
      totalRounds: this.totalRounds,
      sheriffId,
      deckCount: this.deck.length,
      goods: GOODS,
      log: this.log,
      results: this.phase === 'RESOLVE' ? this.lastResults : null,
      scores: this.phase === 'SCORING' ? this.scores : null,
      players: this.players.map(p => {
        const isMe = p.id === playerId;
        return {
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isSheriff: p.id === sheriffId,
          handCount: p.hand?.length ?? 0,
          stallCount: p.stall?.length ?? 0,
          // Public stall: legal goods sit face-up, contraband stays a hidden count.
          stallPublic: this.publicStall(p),
          // MARKET/LOAD/INSPECTION public progress flags:
          ready: !!p.ready,
          hasLoaded: !!p.bagSubmitted,
          declared: p.bag ? { good: p.bag.declaredGood, count: p.bag.declaredCount } : null,
          bribe: p.bribe?.gold ?? null,
          decided: !!p.inspection,
          // Private — owner only (gold is secret; stall revealed at scoring):
          hand: isMe ? p.hand : undefined,
          gold: isMe ? p.gold : undefined,
          bagCards: isMe ? (p.bag?.cards ?? null) : undefined,
          stall: (isMe || revealAll) ? p.stall : undefined,
        };
      }),
    };
  }
}

// Fisher–Yates shuffle — returns a new array, doesn't mutate the input.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { SheriffGame };
