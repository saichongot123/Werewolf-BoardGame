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
         <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255, 75, 75, 0.1)', border: '1px solid #ff4b4b', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#ff4b4b' }}>คืนนี้ <strong>{victim.name}</strong> ถูกหมาป่าทำร้าย!</p>
            {witchPotions?.heal ? (
               <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                 <input type="checkbox" checked={selectedHeal} onChange={(e) => setSelectedHeal(e.target.checked)} />
                 ใช้ยาชุบชีวิต 🧪 (เหลือ 1 ขวด)
               </label>
            ) : (
               <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>(คุณไม่มียาชุบชีวิตเหลือแล้ว)</p>
            )}
         </div>
      ) : (
         <div style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#aaa' }}>
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
        style={{ marginTop: '1.5rem' }} 
        onClick={handleConfirm}
      >
        ยืนยันการใช้ยา
      </button>
    </div>
  );
}

export default WitchPhase;
