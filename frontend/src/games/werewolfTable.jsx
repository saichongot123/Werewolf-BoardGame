import React, { useState, useEffect } from 'react';
import WitchPhase from '../components/WitchPhase';
import { getRole } from '../utils/roles';

// ── Village-circle layout for the in-game Werewolf phases ──
// Seats ring a central stage. When it's your turn to pick someone, you click the
// SEAT itself — selection state lives here and drives a slim confirm bar in the
// bottom dock. The Witch keeps her dedicated panel (two potions, not a plain
// seat-pick). Day voting shows an anonymous live tally on the seats.
//
// Privacy: seats show only PUBLIC info (name, alive/dead, votes-received). A seat
// never reveals a role, and only the viewer's OWN turn glows — so no one can tell
// who the Seer/Doctor is. Role art shows only for people the server lets you see
// (yourself, and — for wolves — the pack).

const NIGHT_ROLE_LABEL = {
  Werewolf: '🐺 หมาป่ากำลังออกล่า...',
  Seer: '🔮 ผู้หยั่งรู้กำลังเพ่งญาณ...',
  Doctor: '💉 หมอกำลังเลือกคนคุ้มครอง...',
  Cupid: '💘 คิวปิดกำลังจับคู่รัก...',
};

// What (if anything) the current player may target right now, and which seats are
// valid picks. Returns null when the player has no seat action this moment.
function getTargeting(gameState, me) {
  if (!me) return null;
  const { phase, currentNightRole } = gameState;

  if (phase === 'NIGHT' && me.isAlive && me.role === currentNightRole) {
    if (me.role === 'Werewolf') {
      const count = gameState.wolfPickCount || 1;
      return { role: 'Werewolf', count,
        prompt: count === 2
          ? 'ฝูงคลั่งแค้น! คลิกเลือกเหยื่อ 2 คน (ทั้งฝูงต้องตรงกัน)'
          : 'คลิกเลือกเหยื่อ (ทั้งฝูงต้องตรงกัน)',
        valid: p => p.isAlive && p.id !== me.id && p.role !== 'Werewolf' };
    }
    if (me.role === 'Seer') {
      return { role: 'Seer', count: 1, prompt: 'คลิกเลือกคนที่จะตรวจสอบ',
        valid: p => p.isAlive && p.id !== me.id };
    }
    if (me.role === 'Doctor') {
      // May shield anyone incl. self, but not the same person as last night.
      if (me.hasActed) return null;
      return { role: 'Doctor', count: 1, prompt: 'คลิกเลือกคนที่จะคุ้มครอง',
        valid: p => p.isAlive && p.id !== gameState.doctorLastProtect };
    }
    if (me.role === 'Cupid') {
      if (me.hasActed) return null;
      return { role: 'Cupid', count: 2, prompt: 'คลิกเลือกคู่รัก 2 คน (เลือกตัวเองได้)',
        valid: p => p.isAlive };
    }
    return null;
  }
  if (phase === 'VOTING' && me.isAlive && !me.hasVoted) {
    return { role: 'Vote', count: 1, prompt: 'คลิกโหวตผู้ที่สงสัย หรือกดข้าม',
      valid: p => p.isAlive };
  }
  if (phase === 'HUNTER_REVENGE' && me.id === gameState.pendingHunter) {
    return { role: 'Hunter', count: 1, prompt: 'คลิกเลือกคนที่จะยิงตายตามไป',
      valid: p => p.isAlive && p.id !== me.id };
  }
  return null;
}

function seatPosition(i, n) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const x = 50 + 44 * Math.cos(angle);
  const y = 50 + 42 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' };
}

function Seat({ p, isMe, phase, currentNightRole, amLover, selectable, selected, votes, isLeader, onPick }) {
  const known = p.role;
  const avatar = known ? `/images/${known}.png` : null;
  const showVoted = phase === 'VOTING' && p.isAlive && p.hasVoted;
  const acting = isMe && phase === 'NIGHT' && p.isAlive && p.role === currentNightRole;
  const isWolfMate = known === 'Werewolf' && !isMe;
  const isLover = amLover && p._isLover;

  return (
    <div className="ww-seat-wrap" style={seatPosition(p._i, p._n)}>
      <div
        className={`ww-seat${p.isAlive ? '' : ' is-dead'}${isMe ? ' is-me' : ''}`
          + `${acting ? ' is-acting' : ''}${selectable ? ' is-selectable' : ''}${selected ? ' is-selected' : ''}`}
        onClick={selectable ? () => onPick(p.id) : undefined}
      >
        <div className="ww-avatar">
          {avatar
            ? <img src={avatar} alt="" />
            : <span className="ww-avatar-fallback">{p.isAlive ? '🧑' : '💀'}</span>}
          {!p.isAlive && <span className="ww-skull">💀</span>}
          {showVoted && <span className="ww-voted">✓</span>}
          {p.isHost && <span className="ww-badge ww-badge-host" title="หัวหน้าห้อง">👑</span>}
          {isWolfMate && <span className="ww-badge ww-badge-wolf" title="พวกหมาป่า">🐺</span>}
          {isLover && <span className="ww-badge ww-badge-lover" title="คู่รัก">💕</span>}
          {votes > 0 && (
            <span className={`ww-tally${isLeader ? ' is-leader' : ''}`} title="คะแนนโหวต">{votes}</span>
          )}
        </div>
        <div className="ww-name">{p.name}{isMe ? ' (คุณ)' : ''}</div>
      </div>
    </div>
  );
}

function CenterStage({ gameState, nightResult }) {
  const { phase, currentNightRole, dayNumber, nightProgress, voteProgress } = gameState;

  if (phase === 'NIGHT') {
    return (
      <div className="ww-center">
        <div className="ww-moon">🌙</div>
        <div className="ww-center-title">คืนที่ {dayNumber}</div>
        <div className="ww-center-sub">{NIGHT_ROLE_LABEL[currentNightRole] || 'ค่ำคืนอันเงียบงัน...'}</div>
        {nightProgress && <div className="ww-center-note">ดำเนินการแล้ว {nightProgress.done}/{nightProgress.total}</div>}
      </div>
    );
  }
  if (phase === 'NIGHT_WITCH') {
    return (
      <div className="ww-center">
        <div className="ww-moon">🧪</div>
        <div className="ww-center-title">คืนที่ {dayNumber}</div>
        <div className="ww-center-sub">🧙 แม่มดกำลังปรุงยา...</div>
      </div>
    );
  }
  if (phase === 'DAY') {
    const dead = (nightResult || []).map(id => gameState.players.find(p => p.id === id)?.name).filter(Boolean);
    return (
      <div className="ww-center">
        <div className="ww-sun">☀️</div>
        <div className="ww-center-title">รุ่งเช้าวันที่ {dayNumber}</div>
        {dead.length > 0
          ? <div className="ww-center-sub" style={{ color: '#ff9a9a' }}>💀 {dead.join(', ')} เสียชีวิต</div>
          : <div className="ww-center-sub">คืนอันเงียบสงบ ไม่มีใครเสียชีวิต</div>}
        <div className="ww-center-note">พูดคุยหาตัวหมาป่า แล้วเตรียมโหวต</div>
      </div>
    );
  }
  if (phase === 'VOTING') {
    return (
      <div className="ww-center">
        <div className="ww-sun">⚖️</div>
        <div className="ww-center-title">ลงคะแนนเสียง</div>
        <div className="ww-center-sub">คลิกที่คนในวงเพื่อโหวต</div>
        {voteProgress && <div className="ww-center-note">โหวตแล้ว {voteProgress.done}/{voteProgress.total}</div>}
      </div>
    );
  }
  if (phase === 'HUNTER_REVENGE') {
    return (
      <div className="ww-center">
        <div className="ww-moon">🏹</div>
        <div className="ww-center-title">การแก้แค้นของนายพราน</div>
        <div className="ww-center-sub">นายพรานกำลังเล็งปืน...</div>
      </div>
    );
  }
  return null;
}

// The dock is now a slim confirm bar: the picking happens on the seats. It also
// hosts the role-specific extras (werewolf live board, seer result, skip button)
// and the Witch's full panel.
function Dock({ gameState, me, targeting, sel, seerResult, onNightAction, onVote, onHunterAction, onWitchAction, onStartVoting }) {
  const { phase } = gameState;

  // Witch keeps her own two-potion panel.
  if (phase === 'NIGHT_WITCH') {
    if (me?.role === 'Witch' && !me.hasActed) {
      return <WitchPhase gameState={gameState} currentPlayer={me} onWitchAction={onWitchAction} />;
    }
    return <div className="ww-dock-hint">แม่มดกำลังตัดสินใจ...</div>;
  }

  // Day: host opens the vote; others wait.
  if (phase === 'DAY') {
    if (me?.isHost) return <button className="danger ww-dock-btn" onClick={onStartVoting}>⚖️ เริ่มโหวตเลย</button>;
    return <div className="ww-dock-hint">รอหัวหน้าห้องเปิดโหวต หรือหมดเวลาพูดคุย</div>;
  }

  // Seer's result stays pinned for the rest of the night.
  const seerCard = me?.role === 'Seer' && seerResult ? (
    <div className="ww-seer-card">
      🔮 <strong>{gameState.players.find(p => p.id === seerResult.targetId)?.name || 'ผู้เล่น'}</strong> คือ{' '}
      <strong style={{ color: seerResult.role === 'Werewolf' ? '#ff6b6b' : '#86efac' }}>
        {getRole(seerResult.role).th}
      </strong>
    </div>
  ) : null;

  if (!targeting) {
    // No action for me right now — a short waiting line + any pinned seer result.
    let hint = '👁️ คุณเฝ้าดูอยู่เงียบ ๆ...';
    if (me?.isAlive) {
      if (phase === 'NIGHT') hint = 'รอบทบาทอื่นทำหน้าที่ตามลำดับ...';
      else if (phase === 'VOTING') hint = 'โหวตแล้ว รอผู้เล่นคนอื่น...';
      else if (phase === 'HUNTER_REVENGE') hint = 'รอการแก้แค้นของนายพราน...';
    }
    return <>{seerCard}<div className="ww-dock-hint">{hint}</div></>;
  }

  const ready = targeting.count === 2 ? sel.length === 2 : !!sel;
  const confirm = () => {
    if (!ready) return;
    if (targeting.role === 'Werewolf' || targeting.role === 'Seer' || targeting.role === 'Doctor') onNightAction(sel);
    else if (targeting.role === 'Cupid') onNightAction(sel);
    else if (targeting.role === 'Vote') onVote(sel);
    else if (targeting.role === 'Hunter') onHunterAction(sel);
  };

  const pack = targeting.role === 'Werewolf' && gameState.werewolfVotes ? (
    <div className="ww-pack">
      <div className="ww-pack-title">🐺 การเลือกของฝูง</div>
      {gameState.werewolfVotes.map(v => (
        <div key={v.voterId} className="ww-pack-row">
          <span>{v.voterName}{v.voterId === me.id ? ' (คุณ)' : ''}</span>
          <span style={{ color: v.targetNames?.length ? '#ff8a8a' : '#7f8bab' }}>
            {v.targetNames?.length ? `→ ${v.targetNames.join(', ')}` : 'ยังไม่เลือก'}
          </span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="ww-actionbar">
      {seerCard}
      {pack}
      <div className="ww-prompt">{targeting.prompt}
        {targeting.count === 2 && <span className="ww-prompt-count"> ({sel.length}/2)</span>}
      </div>
      <div className="ww-actionbar-btns">
        {(targeting.role === 'Vote' || targeting.role === 'Hunter') && (
          <button className="secondary" onClick={() => (targeting.role === 'Vote' ? onVote(null) : onHunterAction(null))}>
            {targeting.role === 'Vote' ? 'ข้ามการโหวต' : 'ไม่ยิงใคร'}
          </button>
        )}
        <button className="danger" disabled={!ready} onClick={confirm}>
          {targeting.role === 'Werewolf' ? 'ยืนยัน / เปลี่ยนเป้า'
            : targeting.role === 'Vote' ? 'ยืนยันโหวต'
            : targeting.role === 'Hunter' ? 'ลั่นไกปืน'
            : 'ยืนยัน'}
        </button>
      </div>
    </div>
  );
}

export default function WerewolfTable(props) {
  const { gameState, currentPlayer } = props;
  const me = currentPlayer;
  const targeting = getTargeting(gameState, me);

  // Selection lives here so seats can drive it. Reset when the turn/phase changes.
  const [sel, setSel] = useState(targeting?.count === 2 ? [] : null);
  const turnKey = gameState.phase === 'NIGHT' ? `NIGHT:${gameState.currentNightRole}` : gameState.phase;
  useEffect(() => { setSel(targeting?.count === 2 ? [] : null); /* eslint-disable-next-line */ }, [turnKey]);

  const pick = (id) => {
    if (!targeting) return;
    if (targeting.count === 2) {
      setSel(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        if (arr.includes(id)) return arr.filter(x => x !== id);
        if (arr.length >= 2) return arr;
        return [...arr, id];
      });
    } else {
      setSel(prev => (prev === id ? null : id));
    }
  };
  const isSelected = (id) => (Array.isArray(sel) ? sel.includes(id) : sel === id);

  const n = gameState.players.length;
  const lovers = gameState.lovers || [];
  const amLover = !!me && lovers.includes(me.id);
  const players = gameState.players.map((p, i) => ({ ...p, _i: i, _n: n, _isLover: lovers.includes(p.id) }));

  // Vote tally (day vote): leader = the current max, shown in red on the seats.
  const tally = gameState.voteTally || {};
  const maxVotes = Object.values(tally).reduce((m, v) => Math.max(m, v), 0);

  const daytime = gameState.phase === 'DAY' || gameState.phase === 'VOTING';

  return (
    <div className={`ww-board ${daytime ? 'ww-day' : 'ww-night'}${n > 12 ? ' ww-crowded' : ''}`}>
      <div className="ww-ring">
        <div className="ww-hearth" aria-hidden="true" />
        {players.map(p => (
          <Seat key={p.id} p={p} isMe={p.id === me?.id}
                phase={gameState.phase} currentNightRole={gameState.currentNightRole}
                amLover={amLover}
                selectable={!!targeting && targeting.valid(p)}
                selected={isSelected(p.id)}
                votes={tally[p.id] || 0}
                isLeader={maxVotes > 0 && (tally[p.id] || 0) === maxVotes}
                onPick={pick} />
        ))}
        <CenterStage gameState={gameState} nightResult={props.nightResult} />
      </div>
      <div className="ww-dock">
        <Dock gameState={gameState} me={me} targeting={targeting} sel={sel}
              seerResult={props.seerResult}
              onNightAction={props.onNightAction} onVote={props.onVote}
              onHunterAction={props.onHunterAction} onWitchAction={props.onWitchAction}
              onStartVoting={props.onStartVoting} />
      </div>
    </div>
  );
}
