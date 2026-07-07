import React, { useState } from 'react';

function WitchPhase({ gameState, currentPlayer, onWitchAction }) {
  const [selectedHeal, setSelectedHeal] = useState(false);
  const [selectedPoison, setSelectedPoison] = useState(null);

  if (!currentPlayer || currentPlayer.role !== 'Witch') {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#4ade80' }}>ช่วงเวลาของแม่มด</h1>
        <p>คุณสัมผัสได้ถึงเวทมนตร์ในอากาศ...</p>
        <div style={{ marginTop: '2rem', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <span className="pulse-text" style={{fontSize: '2rem'}}>🔮</span>
        </div>
      </div>
    );
  }

  if (currentPlayer.hasActed) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#4ade80' }}>ใช้เวทมนตร์เสร็จสิ้น</h1>
        <p>รอการเริ่มต้นของวันใหม่...</p>
      </div>
    );
  }

  const { witchPotions, pendingWitchKill } = gameState;
  const victim = gameState.players.find(p => p.id === pendingWitchKill);
  const otherAlivePlayers = gameState.players.filter(p => p.id !== currentPlayer.id && p.isAlive && p.id !== pendingWitchKill);

  const handleConfirm = () => {
    onWitchAction({ heal: selectedHeal, poison: selectedPoison });
  };

  return (
    <div className="glass-panel">
      <h2 style={{ textAlign: 'center', color: '#4ade80' }}>แม่มด ตื่นขึ้นมา</h2>
      
      {victim ? (
         <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255, 75, 75, 0.1)', border: '1px solid #ff4b4b', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.75rem 0', color: '#ff4b4b' }}>คืนนี้ <strong>{victim.name}</strong> ถูกหมาป่าทำร้าย!</p>
            {witchPotions?.heal ? (
               <div
                 onClick={() => setSelectedHeal(!selectedHeal)}
                 style={{
                   cursor: 'pointer', userSelect: 'none',
                   display: 'flex', alignItems: 'center', gap: '0.75rem',
                   padding: '0.85rem 1rem', borderRadius: '10px',
                   background: selectedHeal ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255,255,255,0.06)',
                   border: `2px solid ${selectedHeal ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
                   transition: 'all 0.2s ease',
                 }}
               >
                 <span style={{
                   width: '26px', height: '26px', flexShrink: 0, borderRadius: '6px',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   background: selectedHeal ? '#4ade80' : 'transparent',
                   border: `2px solid ${selectedHeal ? '#4ade80' : '#888'}`,
                   color: '#0b1a0f', fontWeight: 'bold', fontSize: '1rem',
                 }}>{selectedHeal ? '✓' : ''}</span>
                 <span style={{ textAlign: 'left', color: selectedHeal ? '#86efac' : '#ddd', fontWeight: 'bold' }}>
                   🧪 {selectedHeal ? `จะใช้ยาชุบชีวิตช่วย ${victim.name}` : `แตะเพื่อใช้ยาชุบชีวิตช่วย ${victim.name}`}
                   <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 'normal', color: '#aaa', marginTop: '2px' }}>
                     (มียาชุบชีวิตเหลือ 1 ขวด — ใช้ได้ครั้งเดียวทั้งเกม)
                   </span>
                 </span>
               </div>
            ) : (
               <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>(คุณไม่มียาชุบชีวิตเหลือแล้ว)</p>
            )}
         </div>
      ) : (
         <div style={{ marginBottom: '1.25rem', textAlign: 'center', color: '#aaa' }}>
            <p>คืนนี้ไม่มีใครถูกหมาป่าทำร้าย (หรือหมออาจจะช่วยไว้แล้ว)</p>
         </div>
      )}

      {witchPotions?.poison ? (
         <>
            <p className="status-message">คุณต้องการใช้ยาพิษกับใครหรือไม่?</p>
            <ul className="player-list">
              <li 
                className={`player-item selectable ${selectedPoison === null ? 'selected' : ''}`}
                onClick={() => setSelectedPoison(null)}
              >
                ไม่ใช้ยาพิษ
              </li>
              {otherAlivePlayers.map(p => (
                <li 
                  key={p.id} 
                  className={`player-item selectable ${selectedPoison === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPoison(p.id)}
                >
                  ใช้ยาพิษกับ {p.name} ☠️
                </li>
              ))}
            </ul>
         </>
      ) : (
         <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#666' }}>(คุณไม่มียาพิษเหลือแล้ว)</p>
      )}
      
      <button
        style={{ marginTop: '1.5rem', background: (selectedHeal || selectedPoison) ? '#4ade80' : undefined, color: (selectedHeal || selectedPoison) ? '#0b1a0f' : undefined, fontWeight: 'bold' }}
        onClick={handleConfirm}
      >
        {selectedHeal && selectedPoison ? 'ยืนยัน: ชุบชีวิต + ใช้ยาพิษ'
          : selectedHeal ? 'ยืนยัน: ใช้ยาชุบชีวิต'
          : selectedPoison ? 'ยืนยัน: ใช้ยาพิษ'
          : 'ผ่าน (ไม่ใช้ยา)'}
      </button>
    </div>
  );
}

export default WitchPhase;
