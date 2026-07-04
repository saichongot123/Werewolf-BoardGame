import React, { useState } from 'react';

function HunterPhase({ gameState, currentPlayer, onHunterAction }) {
  const [selectedTarget, setSelectedTarget] = useState(null);

  // If you are not the hunter, you just wait
  // In gameLogic, pendingHunter is the ID of the hunter
  const pendingHunterId = gameState.pendingHunter;
  const isPendingHunter = currentPlayer?.id === pendingHunterId;

  // Filter alive players excluding the hunter themselves (even if they are marked dead in some logic)
  const availableTargets = gameState.players.filter(p => p.isAlive && p.id !== pendingHunterId);

  if (!isPendingHunter) {
    const hunterName = gameState.players.find(p => p.id === pendingHunterId)?.name || 'นายพราน';
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#d8b4fe' }}>ช่วงล้างแค้นของนายพราน</h1>
        <p className="pulse-text">รอให้ {hunterName} (นายพราน) เลือกเป้าหมาย...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <h1 style={{ textAlign: 'center', color: '#ff4b4b' }}>ความแค้นของนายพราน</h1>
      <p className="status-message">คุณกำลังจะตาย! เลือกผู้เล่น 1 คนเพื่อยิงให้ตายตามคุณไป</p>
      
      <ul className="player-list">
        {availableTargets.map(p => (
          <li 
            key={p.id} 
            className={`player-item selectable ${selectedTarget === p.id ? 'selected' : ''}`}
            onClick={() => setSelectedTarget(p.id)}
          >
            {p.name}
          </li>
        ))}
        <li 
          className={`player-item selectable ${selectedTarget === 'skip' ? 'selected' : ''}`}
          onClick={() => setSelectedTarget('skip')}
          style={{ marginTop: '1rem', borderStyle: 'dashed' }}
        >
          ไม่ยิงใคร (ยอมตายคนเดียว)
        </li>
      </ul>
      
      <button 
        style={{ marginTop: '1.5rem' }} 
        disabled={!selectedTarget}
        onClick={() => onHunterAction(selectedTarget === 'skip' ? null : selectedTarget)}
        className="danger"
      >
        ลั่นไกปืน
      </button>
    </div>
  );
}

export default HunterPhase;
