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

  // My turn, but I've already confirmed — wait for the next step
  if (currentPlayer.hasActed) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#45a29e' }}>ยืนยันการกระทำแล้ว</h1>
        <p>กำลังรอบทบาทถัดไปทำหน้าที่...</p>
        {seerCard}
      </div>
    );
  }

  // My turn to act
  const otherAlivePlayers = gameState.players.filter(p => p.id !== currentPlayer.id && p.isAlive);

  const prompt = {
    Werewolf: 'เลือกผู้เล่นที่จะกำจัด:',
    Seer: 'เลือกผู้เล่นที่จะตรวจสอบบทบาท:',
    Doctor: 'เลือกผู้เล่นที่จะคุ้มครอง:',
    Cupid: 'เลือกผู้เล่น 2 คนให้เป็นคู่รักกัน (ตกหลุมรัก):',
  }[currentPlayer.role];

  const handleConfirm = () => {
    if (currentPlayer.role === 'Cupid') {
      if (selectedTarget.length === 2) onAction(selectedTarget);
    } else if (selectedTarget) {
      onAction(selectedTarget);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ textAlign: 'center', color: currentPlayer.role === 'Werewolf' ? '#ff4b4b' : 'var(--text-highlight)' }}>
        {icon} {roleTh} ตื่นขึ้นมา
      </h2>

      {currentPlayer.role === 'Werewolf' && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#ff4b4b', textAlign: 'center' }}>
          หมาป่าคนอื่นๆ: {gameState.players.filter(p => p.role === 'Werewolf' && p.id !== currentPlayer.id && p.isAlive).map(p => p.name).join(', ') || 'ไม่มี'}
        </div>
      )}

      <p className="status-message">{prompt}</p>

      <ul className="player-list">
        {otherAlivePlayers.map(p => {
          const isSelected = currentPlayer.role === 'Cupid'
            ? selectedTarget.includes(p.id)
            : selectedTarget === p.id;

          return (
            <li
              key={p.id}
              className={`player-item selectable ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (currentPlayer.role === 'Cupid') {
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
              {p.name}
            </li>
          );
        })}
        {currentPlayer.role === 'Doctor' && (
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
        disabled={currentPlayer.role === 'Cupid' ? selectedTarget.length !== 2 : !selectedTarget}
        onClick={handleConfirm}
        className={currentPlayer.role === 'Werewolf' ? 'danger' : ''}
      >
        ยืนยัน
      </button>
    </div>
  );
}

export default NightPhase;
