// Sheriff of Nottingham — end-game scoring (pure function, no game/socket deps).
//
// A player's score = leftover gold + value of every good in their stall + the
// King/Queen bonuses. For each legal good, the player with the MOST of it in
// their stall earns that good's kingBonus; the 2nd-most earns queenBonus.
// Ties for 1st: every tied player gets the king bonus and no queen is awarded
// for that good (standard Sheriff rule).

function addBonus(row, amount, label) {
  row.bonuses += amount;
  row.bonusDetail.push({ label, amount });
}

// players: array of { id, name, gold, stall:[goodId,...] }
// GOODS: the card catalog; LEGAL_GOODS: array of legal good ids.
// Returns rows sorted by total desc (winner first).
function computeScores(players, GOODS, LEGAL_GOODS) {
  const rows = players.map(p => {
    const stall = p.stall || [];
    const goodsValue = stall.reduce((sum, id) => sum + (GOODS[id]?.value || 0), 0);
    return {
      id: p.id,
      name: p.name,
      gold: p.gold || 0,
      goodsValue,
      bonuses: 0,
      bonusDetail: [],
      stall,
      total: 0,
    };
  });
  const rowById = Object.fromEntries(rows.map(r => [r.id, r]));

  for (const gid of LEGAL_GOODS) {
    const good = GOODS[gid];
    // How many of this good each player has in their stall.
    const counts = players
      .map(p => ({ id: p.id, n: (p.stall || []).filter(c => c === gid).length }))
      .filter(c => c.n > 0);
    if (counts.length === 0) continue;

    const max = Math.max(...counts.map(c => c.n));
    const topIds = counts.filter(c => c.n === max).map(c => c.id);
    topIds.forEach(id => addBonus(rowById[id], good.kingBonus, `👑 ${good.name}`));

    // Queen only if there's a single, undisputed King.
    if (topIds.length === 1) {
      const rest = counts.filter(c => c.n < max);
      if (rest.length > 0) {
        const max2 = Math.max(...rest.map(c => c.n));
        rest.filter(c => c.n === max2)
            .forEach(c => addBonus(rowById[c.id], good.queenBonus, `🥈 ${good.name}`));
      }
    }
  }

  rows.forEach(r => { r.total = r.gold + r.goodsValue + r.bonuses; });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

module.exports = { computeScores };
