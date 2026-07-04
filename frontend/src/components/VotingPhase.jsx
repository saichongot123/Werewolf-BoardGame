import React, { useState } from 'react';

function VotingPhase({ gameState, currentPlayer, onVote }) {
  const [selectedTarget, setSelectedTarget] = useState(null);

  if (!currentPlayer || !currentPlayer.isAlive) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#ff4b4b' }}>ช่วงเวลาโหวต</h1>
        <p>คุณตายแล้ว คุณไม่สามารถโหวตได้</p>
      </div>
    );
  }

  if (currentPlayer.hasVoted) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: 'var(--text-highlight)' }}>โหวตแล้ว</h1>
        <p>รอให้คนอื่นโหวตจนเสร็จ...</p>
      </div>
    );
  }

  const alivePlayers = gameState.players.filter(p => p.isAlive);

  return (
    <div className="glass-panel">
      <h1 style={{ textAlign: 'center', color: '#ff4b4b' }}>ช่วงเวลาโหวต</h1>
      <p className="status-message">เลือกผู้เล่นที่คุณต้องการโหวตออก หรือจะเลือกข้ามการโหวตก็ได้</p>
      
      <ul className="player-list">
        {alivePlayers.map(p => (
          <li 
            key={p.id} 
            className={`player-item selectable ${selectedTarget === p.id ? 'selected' : ''}`}
            onClick={() => setSelectedTarget(p.id)}
          >
            {p.name} {p.id === currentPlayer.id ? '(คุณ)' : ''}
          </li>
        ))}
        <li 
          className={`player-item selectable ${selectedTarget === 'skip' ? 'selected' : ''}`}
          onClick={() => setSelectedTarget('skip')}
          style={{ marginTop: '1rem', borderStyle: 'dashed' }}
        >
          ข้ามการโหวต
        </li>
      </ul>
      
      <button 
        style={{ marginTop: '1.5rem' }} 
        disabled={!selectedTarget}
        onClick={() => onVote(selectedTarget === 'skip' ? null : selectedTarget)}
        className="danger"
      >
        ยืนยันการโหวต
      </button>
    </div>
  );
}

export default VotingPhase;
