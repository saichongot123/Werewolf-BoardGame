import React from 'react';

function EndGame({ gameState, currentPlayer, onPlayAgain }) {
  const isWerewolfWin = gameState.winner === 'WEREWOLVES';
  
  return (
    <div className="glass-panel" style={{ textAlign: 'center' }}>
      <h1 style={{ color: isWerewolfWin ? '#ff4b4b' : gameState.winner === 'FOOL' ? '#fcd34d' : 'var(--text-highlight)' }}>
        {gameState.winner === 'FOOL' ? 'คนบ้าชนะ!' :
         isWerewolfWin ? 'หมาป่าชนะ!' : 'ชาวบ้านชนะ!'}
      </h1>
      
      <p style={{ margin: '2rem 0', fontSize: '1.2rem' }}>
        {gameState.winner === 'FOOL' 
          ? "คนบ้าทำสำเร็จ! เขาถูกโหวตออกตามที่ตั้งใจไว้ ทุกคนถูกหลอก!"
          : isWerewolfWin 
            ? "หมู่บ้านถูกยึดครอง หมาป่าจะได้เฉลิมฉลองในค่ำคืนนี้" 
            : "หมาป่าถูกกำจัดจนหมดสิ้น ความสงบสุขกลับคืนสู่หมู่บ้านอีกครั้ง"}
      </p>

      <h3 style={{ color: '#fff', marginTop: '2rem' }}>บทบาทของผู้เล่น</h3>
      <ul className="player-list" style={{ textAlign: 'left' }}>
        {gameState.players.map(p => (
          <li key={p.id} className="player-item" style={{ opacity: p.isAlive ? 1 : 0.5 }}>
            <span>
              {p.name} {!p.isAlive && '(ตาย)'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src={`/images/${p.isCub ? 'WolfCub' : p.role}.png`}
                alt={p.role}
                onError={(e) => { e.target.src = '/images/Werewolf.png'; }}
                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{
                color: p.role === 'Werewolf' ? '#ff4b4b' :
                       p.role === 'Seer' ? '#d8b4fe' :
                       p.role === 'Doctor' ? '#86efac' :
                       p.role === 'Fool' ? '#fcd34d' :
                       p.role === 'Hunter' ? '#d8b4fe' :
                       p.role === 'Witch' ? '#4ade80' :
                       p.role === 'Cupid' ? '#f472b6' : 'var(--text-highlight)',
                fontWeight: 'bold'
              }}>
                {p.isCub ? 'ลูกหมาป่า' :
                 p.role === 'Werewolf' ? 'หมาป่า' :
                 p.role === 'Seer' ? 'ผู้หยั่งรู้' :
                 p.role === 'Doctor' ? 'หมอ' :
                 p.role === 'Fool' ? 'คนบ้า' :
                 p.role === 'Hunter' ? 'นายพราน' :
                 p.role === 'Witch' ? 'แม่มด' :
                 p.role === 'Cupid' ? 'คิวปิด' : 'ชาวบ้าน'}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {currentPlayer?.isHost ? (
        <button onClick={onPlayAgain} style={{ marginTop: '2rem' }}>
          เล่นอีกครั้ง
        </button>
      ) : (
        <p style={{ color: '#666', marginTop: '2rem' }}>รอหัวหน้าห้องเริ่มเกมใหม่...</p>
      )}
    </div>
  );
}

export default EndGame;
