import React, { useState, useEffect } from 'react';

// Sheriff of Nottingham — frontend renderer, "tavern table" layout.
//
// Instead of swapping a full-screen panel per phase, we keep ONE persistent
// table: opponents seated across the top, a felt play-area in the middle whose
// contents change with the phase, and your fanned hand along the bottom. This is
// what makes it feel like sitting at a board game. Self-contained: imports no
// Werewolf component; the server owns all truth, screens only reflect it.
export function renderSheriffPhase(ctx) {
  switch (ctx.gameState.phase) {
    case 'LOBBY':   return <SheriffLobby {...ctx} />;
    case 'SCORING': return <ScoringScreen {...ctx} />;
    default:        return <SheriffTable {...ctx} />;
  }
}

const LEGAL_ORDER = ['apple', 'cheese', 'bread', 'chicken'];

// UI icons. Each renders /images/sheriff/icons/{name}.png and falls back to the
// emoji if the file is missing — so art can be dropped in later, no code change.
const ICON_EMOJI = {
  crown: '👑', merchant: '🧑‍🌾', bot: '🤖', bag: '🎒', purse: '👛',
  trophy: '🏆', bribe: '🤝', inspect: '🔍', pass: '👋', resolve: '⚖️',
  medal1: '🥇', medal2: '🥈', medal3: '🥉',
  wait: '⏳', market: '🎪', load: '📦',
};
// `plain` = render bare (no medallion). By default the icon sits in a cream
// "coin" so PNGs that still have a white background blend in and look themed.
function Icon({ name, size = 20, plain }) {
  const [ok, setOk] = useState(true);
  const emoji = ICON_EMOJI[name] || '•';
  const inner = ok
    ? <img src={`/images/sheriff/icons/${name}.png`} alt={emoji} onError={() => setOk(false)}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
    : <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
  if (plain) return inner;
  const box = size + Math.max(4, Math.round(size * 0.22));
  return <span className="sh-icon-token" style={{ width: box, height: box }}>{inner}</span>;
}

// ── card faces ──────────────────────────────────────────────────────────────
function Good({ id, goods, selected, onClick, small }) {
  const g = goods[id] || {};
  const [imgOk, setImgOk] = useState(true);
  const w = small ? 60 : 82;
  const imgH = small ? 58 : 82;
  return (
    <div onClick={onClick} className={selected ? 'sh-pop' : undefined} style={{
      width: w, borderRadius: 10, overflow: 'hidden', position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
      background: g.legal ? 'linear-gradient(160deg,#1f3d2a,#13241a)' : 'linear-gradient(160deg,#3d1f24,#231316)',
      border: `2px solid ${selected ? '#ffd700' : (g.legal ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)')}`,
      transform: selected ? 'translateY(-10px)' : 'none', transition: 'transform .15s, box-shadow .15s',
      boxShadow: selected ? '0 8px 18px rgba(255,215,0,0.4)' : '0 2px 6px rgba(0,0,0,0.4)',
    }}>
      <span style={{ position: 'absolute', top: 3, right: 3, zIndex: 2, background: '#ffd700', color: '#000', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{g.value}</span>
      {!g.legal && <span style={{ position: 'absolute', top: 3, left: 3, zIndex: 2, background: '#ef4444', color: '#fff', borderRadius: 6, minWidth: 20, height: 18, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.66rem', fontWeight: 'bold' }}>⚠{g.penalty}</span>}
      <div style={{ height: imgH, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)' }}>
        {imgOk
          ? <img src={`/images/sheriff/${id}.png`} alt={g.name} onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: small ? '2rem' : '2.6rem' }}>{g.emoji}</span>}
      </div>
      <div style={{ fontSize: '0.7rem', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold', color: '#fff' }}>{g.name}</div>
    </div>
  );
}

function FlipCard({ id, goods, index }) {
  const delay = `${index * 130}ms`;
  return (
    <div className="sh-flip-wrap" style={{ animationDelay: delay }}>
      <div className="sh-flip" style={{ animationDelay: delay }}>
        <div className="sh-flip-face sh-flip-front"><Good id={id} goods={goods} /></div>
        <div className="sh-flip-face sh-flip-back">
          <div style={{ width: '100%', height: '100%', borderRadius: 10, border: '2px solid rgba(212,175,55,0.5)', background: 'repeating-linear-gradient(45deg,#2a2f45,#2a2f45 6px,#232840 6px,#232840 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(212,175,55,0.6)', fontSize: '1.4rem' }}>🎴</div>
        </div>
      </div>
    </div>
  );
}

function CardBack({ small, count }) {
  const [imgOk, setImgOk] = useState(true);
  const w = small ? 40 : 54;
  const h = small ? 55 : 74;
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 7, overflow: 'hidden', border: '2px solid rgba(212,175,55,0.5)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
        {imgOk
          ? <img src="/images/sheriff/back.png" alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#2a2f45,#2a2f45 5px,#232840 5px,#232840 10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(212,175,55,0.6)', fontSize: small ? '1rem' : '1.3rem' }}>🎴</div>}
      </div>
      {count != null && (
        <span style={{ position: 'absolute', bottom: -7, right: -7, zIndex: 3, background: '#d4af37', color: '#000', borderRadius: 9, minWidth: 16, textAlign: 'center', lineHeight: '16px', height: 16, fontSize: '0.68rem', fontWeight: 'bold', padding: '0 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{count}</span>
      )}
    </div>
  );
}

function CardStack({ count, small }) {
  return (
    <div style={{ position: 'relative', width: small ? 40 : 54, height: small ? 55 : 74 }}>
      {[2, 1, 0].map(o => (
        <div key={o} style={{ position: 'absolute', top: o * 3, left: o * 3 }}>
          {o === 0 ? <CardBack small={small} count={count} /> : <CardBack small={small} />}
        </div>
      ))}
    </div>
  );
}

// ── stall tableau + coins ───────────────────────────────────────────────────
// A player's collected goods. For others we get `stallPublic` (legal face-up,
// contraband as a hidden count); for ourselves we pass the full `stall` array.
function StallTableau({ stall, stallPublic, goods, empty }) {
  const counts = {};
  let hidden = 0;
  if (stall) stall.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  else {
    (stallPublic?.legal || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    hidden = stallPublic?.contraband || 0;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0 && hidden === 0) return <span style={{ color: '#7a6a4a', fontSize: '0.72rem' }}>{empty || 'แผงว่าง'}</span>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' }}>
      {entries.map(([id, n]) => (
        <span key={id} className="sh-stall-in" title={goods[id]?.name} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: '1.15rem' }}>{goods[id]?.emoji}</span>
          {n > 1 && <span style={{ fontSize: '0.6rem', color: '#e8c86a' }}>×{n}</span>}
        </span>
      ))}
      {hidden > 0 && (
        <span className="sh-stall-in" title="ของเถื่อน (คว่ำ)" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: '1rem' }}>🎴</span>
          <span style={{ fontSize: '0.6rem', color: '#f87171' }}>×{hidden}</span>
        </span>
      )}
    </div>
  );
}

// My gold shown as a little stack of coins + the number (opponents' gold is
// secret, so they only get a closed purse 👛).
function CoinStack({ amount }) {
  const n = Math.min(8, Math.max(1, Math.round((amount || 0) / 10)));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {Array.from({ length: n }).map((_, i) => <span key={i} className="sh-coin" />)}
      <b key={amount} className="sh-bounce" style={{ color: '#ffd700', marginLeft: 7 }}>{amount ?? '?'}</b>
    </span>
  );
}

// ── opponent seat (leather plaque) ──────────────────────────────────────────
function Seat({ p, phase, goods }) {
  const isBot = p.name?.startsWith('🤖');
  const status =
    phase === 'MARKET' ? (p.ready ? { t: 'พร้อม', c: '#4ade80' } : { t: 'กำลังจัดไพ่…', c: '#8b93a7' }) :
    phase === 'LOAD' ? (p.hasLoaded ? { t: 'ใส่ถุงแล้ว', c: '#4ade80' } : { t: 'กำลังใส่ถุง…', c: '#8b93a7' }) :
    phase === 'INSPECTION' ? (p.decided ? { t: 'ตัดสินแล้ว', c: '#4ade80' } : (p.declared ? { t: `“${p.declared.count} ${goods[p.declared.good]?.name}”`, c: '#e8c86a' } : null)) :
    null;
  return (
    <div className={`sh-seat${p.isSheriff ? ' is-sheriff' : ''}`}>
      <div style={{ lineHeight: 1 }}><Icon name={p.isSheriff ? 'crown' : (isBot ? 'bot' : 'merchant')} size={26} /></div>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f4e4c1', margin: '2px 0 6px' }}>
        {p.name?.replace('🤖 ', '')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
        <CardBack small count={p.handCount} />
        <div style={{ fontSize: '0.72rem', color: '#cbb68a', textAlign: 'left' }}>
          <div title="ทองที่ซ่อนอยู่"><Icon name="purse" size={14} /> ซ่อน</div>
          {p.bribe > 0 && <div style={{ color: '#ffd700' }}><Icon name="bribe" size={14} /> {p.bribe}</div>}
        </div>
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(212,175,55,0.2)' }}>
        <StallTableau stallPublic={p.stallPublic} goods={goods} empty="ยังไม่มีสินค้า" />
      </div>
      {status && <div className="sh-chip" style={{ marginTop: 6, color: status.c, background: 'rgba(0,0,0,0.3)' }}>{status.t}</div>}
    </div>
  );
}

// ── the persistent table ────────────────────────────────────────────────────
function SheriffTable({ gameState, currentPlayer, onGameAction }) {
  const goods = gameState.goods;
  const me = currentPlayer || {};
  const amSheriff = !!me.isSheriff;
  const others = gameState.players.filter(p => p.id !== me.id);
  const sheriff = gameState.players.find(p => p.isSheriff);

  const [sel, setSel] = useState([]);
  const [declared, setDeclared] = useState('apple');
  const [bribe, setBribe] = useState(0);
  // Reset transient selection whenever we enter a new phase/round.
  useEffect(() => { setSel([]); setBribe(0); }, [gameState.phase, gameState.round]);

  const hand = me.hand || [];
  const phase = gameState.phase;
  const handSelectable = !amSheriff && (
    (phase === 'MARKET' && !me.ready) || (phase === 'LOAD' && !me.hasLoaded)
  );
  const toggle = i => {
    if (!handSelectable) return;
    setSel(s => {
      if (s.includes(i)) return s.filter(x => x !== i);
      if (phase === 'LOAD' && s.length >= 5) return s; // bag max 5
      return [...s, i];
    });
  };

  return (
    <div className="sh-table">
      {/* seats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
        {others.map(p => <Seat key={p.id} p={p} phase={phase} goods={goods} />)}
      </div>

      {/* felt center: deck/discard + phase stage */}
      <div className="sh-felt">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <CardBack count={gameState.deckCount} />
            <div style={{ fontSize: '0.62rem', color: '#cbb68a', marginTop: 5 }}>กองจั่ว</div>
          </div>
          <div style={{ textAlign: 'center', color: '#e8c86a', fontSize: '0.82rem' }}>
            <div>รอบ {gameState.round}/{gameState.totalRounds}</div>
            <div style={{ fontSize: '0.75rem', color: '#cbb68a' }}>นายอำเภอ: <Icon name="crown" size={14} /> {sheriff?.name?.replace('🤖 ', '')}</div>
          </div>
          <div style={{ width: 54 }} />
        </div>
        <div style={{ minHeight: 120 }}>
          <CenterStage {...{ gameState, me, amSheriff, others, goods, sel, declared, setDeclared, bribe, setBribe, onGameAction }} />
        </div>
      </div>

      {/* my area */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#f4e4c1', fontWeight: 'bold' }}>
            ไพ่ของคุณ {amSheriff && <span style={{ color: '#d4af37' }}>· <Icon name="crown" size={15} /> คุณคือนายอำเภอ</span>}
          </span>
          <span className="sh-plate"><CoinStack amount={me.gold} /></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: '#cbb68a', fontSize: '0.78rem' }}>แผงของฉัน:</span>
          <StallTableau stall={me.stall} goods={goods} empty="ยังไม่มีสินค้า" />
        </div>
        <FannedHand hand={hand} goods={goods} sel={sel} onToggle={toggle} dim={!handSelectable} />
      </div>
    </div>
  );
}

// The bottom hand, arranged as an overlapping fan.
function FannedHand({ hand, goods, sel, onToggle, dim }) {
  const n = hand.length;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: 112, opacity: dim ? 0.72 : 1 }}>
      {hand.map((id, i) => {
        const ang = (i - (n - 1) / 2) * 4;
        return (
          <div key={i} className="sh-deal" style={{ animationDelay: `${i * 60}ms`, marginLeft: i ? -14 : 0, zIndex: sel.includes(i) ? 50 : i }}>
            <div style={{ transform: `rotate(${ang}deg)`, transformOrigin: 'bottom center' }}>
              <Good id={id} goods={goods} selected={sel.includes(i)} onClick={() => onToggle(i)} />
            </div>
          </div>
        );
      })}
      {n === 0 && <span style={{ color: '#8b93a7' }}>(ไม่มีไพ่บนมือ)</span>}
    </div>
  );
}

// The middle of the table — its content is the current phase.
function CenterStage({ gameState, me, amSheriff, others, goods, sel, declared, setDeclared, bribe, setBribe, onGameAction }) {
  const phase = gameState.phase;

  if (phase === 'MARKET') {
    if (amSheriff) return <Note icon="crown" title="คุณเป็นนายอำเภอประจำรอบนี้" sub="รอพ่อค้าจัดไพ่ในมือ" />;
    if (me.ready) return <Note icon="wait" title="พร้อมแล้ว" sub="รอพ่อค้าคนอื่น" />;
    return (
      <Note icon="market" title="ช่วงตลาด" sub="เลือกไพ่ด้านล่างที่จะทิ้ง แล้วจั่วใหม่ให้ครบ 6 ใบ (หรือกดพร้อมเลย)">
        <button className="sh-gold-btn" style={{ width: 'auto', padding: '0.5rem 1.4rem' }}
          onClick={() => onGameAction({ type: 'market_ready', discard: sel })}>
          {sel.length ? `ทิ้ง ${sel.length} ใบ & จั่วใหม่` : 'พร้อม (ไม่ทิ้ง)'}
        </button>
      </Note>
    );
  }

  if (phase === 'LOAD') {
    if (amSheriff) return <Note icon="crown" title="คุณเป็นนายอำเภอ" sub="รอพ่อค้าใส่ของลงถุงและประกาศ" />;
    if (me.hasLoaded) return <Note icon="wait" title="ใส่ถุงเรียบร้อย" sub="รอพ่อค้าคนอื่น" />;
    const legal = LEGAL_ORDER.map(id => goods[id]).filter(Boolean);
    const ok = sel.length >= 1 && sel.length <= 5;
    const bagCards = sel.map(i => me.hand[i]).filter(Boolean);
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f4e4c1', marginBottom: 8 }}>เลือกไพ่ใส่ถุง 1–5 ใบ (ล่าง) แล้ว<b> ประกาศ</b> ว่าเป็นสินค้าอะไร — โกหกได้!</div>
        {/* the sack: selected cards slide in here */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', minHeight: 74, margin: '0 auto 10px', padding: '8px 14px', maxWidth: 460,
          background: 'rgba(0,0,0,0.3)', border: '2px dashed rgba(212,175,55,0.5)', borderRadius: 12 }}>
          <span style={{ marginRight: 4 }}><Icon name="bag" size={26} /></span>
          {bagCards.length === 0
            ? <span style={{ color: '#7a6a4a', fontSize: '0.82rem' }}>ยังไม่ได้ใส่ไพ่</span>
            : bagCards.map((id, i) => <div key={`${sel[i]}-${id}`} className="sh-slide-in"><Good id={id} goods={goods} small /></div>)}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          {legal.map(g => (
            <button key={g.id} className={declared === g.id ? 'sh-gold-btn' : 'sh-wood-btn'} onClick={() => setDeclared(g.id)}
              style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>{g.emoji} {g.name}</button>
          ))}
        </div>
        <div style={{ color: '#e8c86a', fontWeight: 'bold', marginBottom: 8 }}>ประกาศ: “{sel.length} {goods[declared]?.name}”</div>
        <button className="sh-gold-btn" disabled={!ok} style={{ width: 'auto', padding: '0.5rem 1.4rem' }}
          onClick={() => onGameAction({ type: 'load_bag', cardIndices: sel, declaredGood: declared })}>
          📦 ใส่ถุง & ประกาศ
        </button>
      </div>
    );
  }

  if (phase === 'INSPECTION') {
    if (amSheriff) {
      return (
        <div>
          <div style={{ textAlign: 'center', color: '#f4e4c1', marginBottom: 10 }}>เลือกจัดการแต่ละถุง — ตรวจ (เสี่ยงจ่ายค่าปรับถ้าเขาพูดจริง), ปล่อยผ่าน หรือรับสินบน</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {others.map(m => (
              <div key={m.id} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 10, minWidth: 150 }}>
                <CardStack count={m.declared?.count} />
                <div style={{ fontWeight: 'bold', color: '#f4e4c1', marginTop: 8 }}>{m.name?.replace('🤖 ', '')}</div>
                <div style={{ fontSize: '0.8rem', color: '#e8c86a' }}>“{m.declared?.count} {goods[m.declared?.good]?.name}”</div>
                {m.bribe > 0 && <div style={{ fontSize: '0.78rem', color: '#ffd700', marginTop: 2 }}>🤝 เสนอ {m.bribe}</div>}
                {m.decided ? (
                  <div style={{ color: '#4ade80', fontSize: '0.82rem', marginTop: 8 }}>✓ ตัดสินแล้ว</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                    <button className="sh-wood-btn" style={{ padding: '0.3rem', fontSize: '0.8rem' }} onClick={() => onGameAction({ type: 'inspect_decision', targetId: m.id, decision: 'inspect' })}><Icon name="inspect" size={14} /> ตรวจ</button>
                    <button className="sh-wood-btn" style={{ padding: '0.3rem', fontSize: '0.8rem' }} onClick={() => onGameAction({ type: 'inspect_decision', targetId: m.id, decision: 'pass' })}><Icon name="pass" size={14} /> ปล่อยผ่าน</button>
                    {m.bribe > 0 && <button className="sh-gold-btn" style={{ padding: '0.3rem', fontSize: '0.8rem' }} onClick={() => onGameAction({ type: 'inspect_decision', targetId: m.id, decision: 'accept_bribe' })}><Icon name="bribe" size={14} /> รับ {m.bribe}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    // merchant view
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f4e4c1', marginBottom: 8 }}>ถุงของคุณ — ประกาศ “{me.declared?.count} {goods[me.declared?.good]?.name}”</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
          {(me.bagCards || []).map((id, i) => <Good key={i} id={id} goods={goods} small />)}
        </div>
        {me.decided ? (
          <Note icon="resolve" title="นายอำเภอตัดสินถุงคุณแล้ว" sub="รอผลการตรวจ…" />
        ) : (
          <div>
            <div style={{ color: '#cbb68a', fontSize: '0.85rem', marginBottom: 8 }}>เสนอสินบนให้ปล่อยผ่าน? (ถ้ามีของเถื่อน) — คุยต่อรองในแชทได้</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              {[1, 5, 10, 20].map(n => (
                <button key={n} className="sh-wood-btn" disabled={bribe + n > me.gold} style={{ width: 'auto', padding: '0.35rem 0.7rem' }}
                  onClick={() => setBribe(b => Math.min(me.gold, b + n))}>+{n}</button>
              ))}
              <button className="sh-wood-btn" disabled={bribe >= me.gold} style={{ width: 'auto', padding: '0.35rem 0.7rem' }} onClick={() => setBribe(me.gold)}>ทั้งหมด</button>
              <button className="sh-wood-btn" disabled={bribe === 0} style={{ width: 'auto', padding: '0.35rem 0.7rem' }} onClick={() => setBribe(0)}>ล้าง</button>
            </div>
            <div style={{ color: '#e8c86a', marginBottom: 8 }}>จำนวน: <b style={{ color: '#ffd700', fontSize: '1.1rem' }}>{bribe}</b> <span style={{ color: '#cbb68a', fontSize: '0.8rem' }}>(มีทอง {me.gold})</span></div>
            <button className="sh-gold-btn" disabled={bribe === 0} style={{ width: 'auto', padding: '0.4rem 1.2rem' }} onClick={() => onGameAction({ type: 'offer_bribe', gold: bribe })}><Icon name="bribe" size={16} /> เสนอสินบน {bribe}</button>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'RESOLVE') {
    const results = gameState.results || [];
    return (
      <div>
        <div style={{ textAlign: 'center', color: '#e8c86a', fontWeight: 'bold', marginBottom: 10 }}>⚖️ ผลการตรวจ</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {results.map(r => {
            const badge = r.decision === 'inspect'
              ? (r.honest ? { t: '✅ พูดจริง', c: '#4ade80' } : { t: '🚨 โกหก!', c: '#f87171' })
              : (r.decision === 'accept_bribe' ? { t: '🤝 รับสินบน', c: '#ffd700' } : { t: '👋 ผ่าน', c: '#cbb68a' });
            return (
              <div key={r.merchantId} style={{ position: 'relative', background: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 10, minWidth: 160, overflow: 'hidden' }}>
                {r.merchantGold !== 0 && (
                  <span className="sh-float" style={{ position: 'absolute', top: 34, right: 12, fontWeight: 'bold', fontSize: '1.1rem', color: r.merchantGold > 0 ? '#4ade80' : '#f87171', pointerEvents: 'none' }}>
                    {r.merchantGold > 0 ? '+' : ''}{r.merchantGold}💰
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ color: '#f4e4c1' }}>{r.name?.replace('🤖 ', '')}</b>
                  <span style={{ color: badge.c, fontSize: '0.8rem', fontWeight: 'bold' }}>{badge.t}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#cbb68a', margin: '4px 0' }}>ประกาศ {r.declaredCount} {goods[r.declaredGood]?.name}:</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {r.cards.map((id, i) => <FlipCard key={i} id={id} goods={goods} index={i} />)}
                  {r.cards.length === 0 && <span style={{ color: '#8b93a7', fontSize: '0.8rem' }}>(ถุงว่าง)</span>}
                </div>
                {r.confiscated.length > 0 && <div style={{ color: '#f87171', fontSize: '0.72rem', marginTop: 5 }}>ยึด {r.confiscated.length} · เข้าแผง {r.toStall.length}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          {amSheriff
            ? <button className="sh-gold-btn" style={{ width: 'auto', padding: '0.5rem 1.6rem' }} onClick={() => onGameAction({ type: 'continue' })}>ดำเนินการต่อ →</button>
            : <span style={{ color: '#cbb68a', fontSize: '0.85rem' }}>รอนายอำเภอดำเนินการต่อ (หรือรออัตโนมัติ)…</span>}
        </div>
      </div>
    );
  }
  return null;
}

function Note({ icon, title, sub, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div><Icon name={icon} size={40} /></div>
      <div style={{ fontWeight: 'bold', color: '#f4e4c1', margin: '4px 0' }}>{title}</div>
      {sub && <div style={{ color: '#cbb68a', fontSize: '0.85rem', marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

// ── LOBBY ───────────────────────────────────────────────────────────────────
function SheriffLobby({ gameState, currentPlayer, onStartGame, onKickPlayer, onGameAction, error }) {
  const count = gameState.players.length;
  const canStart = count >= 3 && count <= 6;
  const botCount = gameState.players.filter(p => p.name?.startsWith('🤖')).length;
  return (
    <div className="glass-panel">
      <h2>👑 ผู้ตรวจการแห่งนอตติงแฮม</h2>
      <p className="status-message">รหัสห้อง: <span style={{ color: '#fff', letterSpacing: '4px' }}>{gameState.roomCode}</span></p>
      {error && <p style={{ color: '#ff4b4b', textAlign: 'center' }}>{error}</p>}
      <ul className="player-list">
        {gameState.players.map(p => (
          <li key={p.id} className="player-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span>{p.name} {p.id === currentPlayer?.id ? '(คุณ)' : ''}</span>
              {p.isHost && <span style={{ color: 'var(--accent-color)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>หัวหน้าห้อง</span>}
            </div>
            {currentPlayer?.isHost && p.id !== currentPlayer.id && (
              <button style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255,75,75,0.2)', color: '#ff4b4b', border: '1px solid #ff4b4b' }} onClick={() => onKickPlayer(p.id)}>เตะ</button>
            )}
          </li>
        ))}
      </ul>
      {currentPlayer?.isHost && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          <button style={{ width: 'auto', padding: '0.4rem 0.9rem', background: 'rgba(74,222,128,0.15)', border: '1px solid #4ade80', color: '#4ade80' }} disabled={count >= 6} onClick={() => onGameAction({ type: 'add_bot' })}>➕ เพิ่มบอท</button>
          <button style={{ width: 'auto', padding: '0.4rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)' }} disabled={botCount === 0} onClick={() => onGameAction({ type: 'remove_bot' })}>➖ ลบบอท</button>
        </div>
      )}
      <div style={{ marginTop: '1.5rem' }}>
        {currentPlayer?.isHost ? (
          <button onClick={onStartGame} disabled={!canStart} className={canStart ? 'danger' : ''}>เริ่มเกม ({count}/6)</button>
        ) : (
          <p style={{ textAlign: 'center', color: '#666' }}>รอหัวหน้าห้องเริ่มเกม...</p>
        )}
        {!canStart && currentPlayer?.isHost && <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#ff4b4b' }}>ต้องการผู้เล่น 3–6 คน (เพิ่มบอทได้)</p>}
      </div>
    </div>
  );
}

// ── SCORING ─────────────────────────────────────────────────────────────────
function ScoringScreen({ gameState, currentPlayer, onPlayAgain }) {
  const goods = gameState.goods;
  const scores = gameState.scores || [];
  const winner = scores[0];
  return (
    <div className="sh-table">
      <h2 className="sh-title" style={{ textAlign: 'center' }}><Icon name="trophy" size={28} /> จบเกม!</h2>
      {winner && <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#ffd700', fontWeight: 'bold' }}>ผู้ชนะ: {winner.name?.replace('🤖 ', '')} ({winner.total} แต้ม)</p>}
      {scores.map((r, i) => (
        <div key={r.id} style={{ background: i === 0 ? 'rgba(255,215,0,0.12)' : 'rgba(0,0,0,0.28)', border: i === 0 ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.75rem', margin: '0.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ color: '#f4e4c1' }}>{i < 3 ? <Icon name={`medal${i + 1}`} size={20} /> : `${i + 1}.`} {r.name?.replace('🤖 ', '')}</b>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>{r.total}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbb68a' }}>
            💰 ทอง {r.gold} + สินค้า {r.goodsValue} + โบนัส {r.bonuses}
            {r.bonusDetail.map((b, k) => <span key={k}> · {b.label} +{b.amount}</span>)}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: 6 }}>
            {(r.stall || []).map((id, k) => <span key={k} title={goods[id]?.name} style={{ fontSize: '1.1rem' }}>{goods[id]?.emoji}</span>)}
          </div>
        </div>
      ))}
      {currentPlayer?.isHost && <button className="danger" style={{ marginTop: '1rem' }} onClick={onPlayAgain}>เล่นอีกครั้ง</button>}
    </div>
  );
}
