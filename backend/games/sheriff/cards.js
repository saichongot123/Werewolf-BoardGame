// ─────────────────────────────────────────────────────────────────────────
// Sheriff of Nottingham — CARD CATALOG (single source of truth)
//
// Every rule that touches a card (dealing, scoring, inspection penalties)
// reads from here. Change a number here → the whole game updates.
//
// Counts/values verified against the 2nd Edition components: 204 goods cards =
// 144 legal + 60 contraband (the 12 special "Royal Goods" cards are a separate
// feature, modeled later). The *structure* is what the code depends on, not the
// exact values, so tweaking these later is still safe.
// ─────────────────────────────────────────────────────────────────────────

// A "good" = one type of card. Fields:
//   id         stable key used everywhere in code (never shows to the player)
//   name       Thai display name
//   emoji      placeholder art — swapped for a real <img> at the art milestone
//   legal      true  = can be openly (and truthfully) declared to the Sheriff
//              false = contraband, must be smuggled; worth more but risky
//   value      gold earned when this card is safe in your stall (end-game)
//   penalty    fine paid if caught smuggling it (contraband only)
//   count      how many copies exist in the draw deck
//   kingBonus  end-game bonus for owning the MOST of this good (legal only)
//   queenBonus end-game bonus for owning the 2nd MOST (legal only)
const GOODS = {
  // ── Legal goods — can be declared honestly ──
  // (legal goods also carry a `penalty`: it's what the Sheriff pays you per card
  //  if they wrongly inspect an honest bag of them)
  apple:   { id: 'apple',   name: 'แอปเปิล', emoji: '🍎', legal: true,  value: 2, penalty: 2, count: 48, kingBonus: 20, queenBonus: 10 },
  cheese:  { id: 'cheese',  name: 'ชีส',     emoji: '🧀', legal: true,  value: 3, penalty: 2, count: 36, kingBonus: 15, queenBonus: 10 },
  bread:   { id: 'bread',   name: 'ขนมปัง',  emoji: '🍞', legal: true,  value: 3, penalty: 2, count: 36, kingBonus: 15, queenBonus: 10 },
  chicken: { id: 'chicken', name: 'ไก่',     emoji: '🐔', legal: true,  value: 4, penalty: 2, count: 24, kingBonus: 10, queenBonus: 5  },

  // ── Contraband — illegal; higher value, but a fine if the Sheriff catches you ──
  pepper:   { id: 'pepper',   name: 'พริกไทย',  emoji: '🌶️', legal: false, value: 6, penalty: 2, count: 22 },
  mead:     { id: 'mead',     name: 'เหล้าหมัก', emoji: '🍺', legal: false, value: 7, penalty: 3, count: 21 },
  silk:     { id: 'silk',     name: 'ผ้าไหม',   emoji: '🧵', legal: false, value: 9, penalty: 4, count: 12 },
  crossbow: { id: 'crossbow', name: 'หน้าไม้',  emoji: '🏹', legal: false, value: 9, penalty: 4, count: 5  },
};

// Convenience lists (derived from GOODS so they never drift out of sync)
const LEGAL_GOODS = Object.values(GOODS).filter(g => g.legal).map(g => g.id);
const CONTRABAND  = Object.values(GOODS).filter(g => !g.legal).map(g => g.id);

// Look up a good's definition by id. Returns undefined for unknown ids.
function getGood(id) {
  return GOODS[id];
}

// Build the full draw deck as a flat array of good-ids, e.g.
//   ['apple','apple', ... ,'chicken', ... ,'pepper', ...]
// Cards of the same type are identical (fungible), so a plain id string per
// card is enough — no need for unique per-card ids. Kept pure (no shuffle) so
// it's deterministic and easy to test; the game shuffles it in startGame().
function buildDeck() {
  const deck = [];
  for (const good of Object.values(GOODS)) {
    for (let i = 0; i < good.count; i++) deck.push(good.id);
  }
  return deck;
}

module.exports = { GOODS, LEGAL_GOODS, CONTRABAND, getGood, buildDeck };
