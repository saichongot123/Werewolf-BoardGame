import React from 'react';

function DayPhase({ gameState, currentPlayer, nightResult, onStartVoting }) {
  const getVictimsText = () => {
    if (!nightResult || nightResult.length === 0) {
      return "คืนที่ผ่านมาเป็นคืนที่สงบสุข ไม่มีใครตาย";
    }
    
    const victims = nightResult.map(id => {
      const p = gameState.players.find(player => player.id === id);
      return p ? p.name : 'Unknown';
    });
    
    return `เกิดเรื่องสลดขึ้น! ${victims.join(', ')} ถูกพบเป็นศพ`;
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'center' }}>
      <h1 style={{ color: '#fcd34d' }}>รุ่งสาง</h1>
      
      <div style={{ margin: '2rem 0', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', color: nightResult?.length > 0 ? '#ff4b4b' : '#86efac' }}>
          {getVictimsText()}
        </p>
      </div>

      <p className="pulse-text" style={{ marginBottom: '2rem' }}>
        พูดคุยกันได้เลย ใครที่มีท่าทีน่าสงสัยบ้าง?
      </p>

      {currentPlayer?.isHost ? (
        <button onClick={onStartVoting}>
          เริ่มการโหวต
        </button>
      ) : (
        <p style={{ color: '#666' }}>รอหัวหน้าห้องเปิดโหวต...</p>
      )}
    </div>
  );
}

export default DayPhase;
