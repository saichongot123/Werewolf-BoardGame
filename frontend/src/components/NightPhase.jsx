import React, { useState } from 'react';
import { getRole } from '../utils/roles';

const ROLE_ICON = { Werewolf: '🐺', Seer: '🔮', Doctor: '💉', Cupid: '💘' };

function NightPhase({ gameState, currentPlayer, onAction, seerResult }) {
  const currentRole = gameState.currentNightRole;
  const [selectedTarget, setSelectedTarget] = useState(currentPlayer.role === 'Cupid' ? [] : null);

  // Dead players just watch the night unfold
  if (!currentPlayer || !currentPlayer.isAlive) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#ff4b4b' }}>ค่ำคืนได้มาเยือนแล้ว</h1>
        <p>คุณตายแล้ว จุ๊ๆ... อย่าบอกอะไรกับคนที่ยังมีชีวิตอยู่ล่ะ</p>
        <div style={{ marginTop: '2rem', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="pulse-text" style={{ fontSize: '2rem' }}>👁️‍🗨️</span>
        </div>
      </div>
    );
  }

  const roleTh = currentRole ? getRole(currentRole).th : '';
  const icon = ROLE_ICON[currentRole] || '🌙';
  const isMyTurn = currentPlayer.role === currentRole;

  // The Seer's result must stay visible for the rest of the night — the step
  // advances the instant they confirm, so it can't only live on the action screen.
  const seerCard = currentPlayer.role === 'Seer' && seerResult ? (
    <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
      <h3 style={{ color: 'var(--text-highlight)' }}>🔮 ผลการตรวจสอบ</h3>
      <p>
        <strong>{gameState.players.find(p => p.id === seerResult.targetId)?.name || 'ผู้เล่น'}</strong> คือ{' '}
        <strong style={{ color: seerResult.role === 'Werewolf' ? '#ff4b4b' : '#86efac' }}>{getRole(seerResult.role).th}</strong>
      </p>
    </div>
  ) : null;

  // Someone else's step — wait, but see who is currently acting (and keep the Seer's result)
  if (!isMyTurn) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#45a29e' }}>ค่ำคืนได้มาเยือนแล้ว</h1>
        <div style={{ margin: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span className="pulse-text" style={{ fontSize: '3rem' }}>{icon}</span>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-highlight)' }}>
            {roleTh} กำลังทำหน้าที่...
          </p>
          <p style={{ fontSize: '0.9rem', color: '#888' }}>โปรดรอสักครู่ ให้แต่ละบทบาททำหน้าที่ตามลำดับ</p>
        </div>
        {seerCard}
      </div>
    );
  }

  const isWolf = currentPlayer.role === 'Werewolf';
  const isCupid = currentPlayer.role === 'Cupid';

  // Wolves keep coordinating even after they've picked (they can change their vote
  // until the whole pack agrees), so they never see the "waiting" screen here.
  // Everyone else is done the moment they confirm.
  if (currentPlayer.hasActed && !isWolf) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#45a29e' }}>ยืนยันการกระทำแล้ว</h1>
        <p>กำลังรอบทบาทถัดไปทำหน้าที่...</p>
        {seerCard}
      </div>
    );
  }

  // Doctor may not shield the same player two nights running.
  const blockedId = currentPlayer.role === 'Doctor' ? gameState.doctorLastProtect : null;

  // Candidate list. Cupid may pick anyone incl. themselves; others exclude self
  // (the Doctor gets a dedicated self row). Wolves never see their own pack.
  const candidates = gameState.players.filter(p =>
    p.isAlive &&
    (isCupid || p.id !== currentPlayer.id) &&
    !(isWolf && p.role === 'Werewolf')
  );

  const prompt = {
    Werewolf: 'เลือกผู้เล่นที่จะกำจัด (ทั้งฝูงต้องเลือกตรงกัน):',
    Seer: 'เลือกผู้เล่นที่จะตรวจสอบบทบาท:',
    Doctor: 'เลือกผู้เล่นที่จะคุ้มครอง:',
    Cupid: 'เลือกผู้เล่น 2 คนให้เป็นคู่รักกัน (เลือกตัวเองได้):',
  }[currentPlayer.role];

  const handleConfirm = () => {
    if (isCupid) {
      if (selectedTarget.length === 2) onAction(selectedTarget);
    } else if (selectedTarget) {
      onAction(selectedTarget);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ textAlign: 'center', color: isWolf ? '#ff4b4b' : 'var(--text-highlight)' }}>
        {icon} {roleTh} ตื่นขึ้นมา
      </h2>

      {isWolf && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#ff4b4b', textAlign: 'center' }}>
          หมาป่าคนอื่นๆ: {gameState.players.filter(p => p.role === 'Werewolf' && p.id !== currentPlayer.id && p.isAlive).map(p => p.name).join(', ') || 'ไม่มี'}
        </div>
      )}

      {/* Live vote board — wolves converge on one victim together */}
      {isWolf && gameState.werewolfVotes && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#ffb3b3', marginBottom: '0.5rem', textAlign: 'center' }}>🐺 การเลือกของฝูง</div>
          {gameState.werewolfVotes.map(v => (
            <div key={v.voterId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fff', padding: '2px 4px' }}>
              <span>{v.voterName}{v.voterId === currentPlayer.id ? ' (คุณ)' : ''}</span>
              <span style={{ color: v.targetName ? '#ff8a8a' : '#888' }}>{v.targetName ? `→ ${v.targetName}` : 'ยังไม่เลือก'}</span>
            </div>
          ))}
        </div>
      )}

      <p className="status-message">{prompt}</p>

      <ul className="player-list">
        {candidates.map(p => {
          const isSelected = isCupid ? selectedTarget.includes(p.id) : selectedTarget === p.id;
          const isBlocked = p.id === blockedId;
          const isSelf = p.id === currentPlayer.id;

          return (
            <li
              key={p.id}
              className={`player-item ${isBlocked ? '' : 'selectable'} ${isSelected ? 'selected' : ''}`}
              style={isBlocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              onClick={() => {
                if (isBlocked) return;
                if (isCupid) {
                  if (selectedTarget.includes(p.id)) {
                    setSelectedTarget(selectedTarget.filter(id => id !== p.id));
                  } else if (selectedTarget.length < 2) {
                    setSelectedTarget([...selectedTarget, p.id]);
                  }
                } else {
                  setSelectedTarget(p.id);
                }
              }}
            >
              {p.name}{isSelf ? ' (ตัวคุณเอง)' : ''}{isBlocked ? ' — ปกป้องไปเมื่อคืน' : ''}
            </li>
          );
        })}
        {currentPlayer.role === 'Doctor' && blockedId !== currentPlayer.id && (
          <li
            className={`player-item selectable ${selectedTarget === currentPlayer.id ? 'selected' : ''}`}
            onClick={() => setSelectedTarget(currentPlayer.id)}
          >
            {currentPlayer.name} (ตัวคุณเอง)
          </li>
        )}
      </ul>

      <button
        style={{ marginTop: '1.5rem' }}
        disabled={isCupid ? selectedTarget.length !== 2 : !selectedTarget}
        onClick={handleConfirm}
        className={isWolf ? 'danger' : ''}
      >
        {isWolf ? 'ยืนยัน / เปลี่ยนเป้าหมาย' : 'ยืนยัน'}
      </button>
    </div>
  );
}

export default NightPhase;
