import React, { useState } from 'react';

function NightPhase({ gameState, currentPlayer, onAction, seerResult }) {
  const [selectedTarget, setSelectedTarget] = useState(currentPlayer.role === 'Cupid' ? [] : null);

  if (!currentPlayer || !currentPlayer.isAlive) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#ff4b4b' }}>ค่ำคืนได้มาเยือนแล้ว</h1>
        <p>คุณตายแล้ว จุ๊ๆ... อย่าบอกอะไรกับคนที่ยังมีชีวิตอยู่ล่ะ</p>
        <div style={{ marginTop: '2rem', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <span className="pulse-text" style={{fontSize: '2rem'}}>👁️‍🗨️</span>
        </div>
      </div>
    );
  }

  // Cupid only picks lovers on the first night; once lovers exist, Cupid just sleeps.
  const cupidAlreadyActed = currentPlayer.role === 'Cupid' && gameState.lovers?.length === 2;
  const isSpecialRole = ['Werewolf', 'Seer', 'Doctor', 'Cupid'].includes(currentPlayer.role) && !cupidAlreadyActed;
  const otherAlivePlayers = gameState.players.filter(p => p.id !== currentPlayer.id && p.isAlive);

  const renderActionPrompt = () => {
    switch (currentPlayer.role) {
      case 'Werewolf':
        return 'เลือกผู้เล่นที่จะกำจัด:';
      case 'Seer':
        return 'เลือกผู้เล่นที่จะตรวจสอบบทบาท:';
      case 'Doctor':
        return 'เลือกผู้เล่นที่จะคุ้มครอง:';
      case 'Cupid':
        return 'เลือกผู้เล่น 2 คนให้เป็นคู่รักกัน (ตกหลุมรัก):';
      default:
        return null;
    }
  };

  const handleConfirm = () => {
    if (currentPlayer.role === 'Cupid') {
       if (selectedTarget.length === 2) {
          onAction(selectedTarget);
       }
    } else if (selectedTarget) {
      onAction(selectedTarget);
    }
  };

  if (currentPlayer.hasActed) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#45a29e' }}>ยืนยันการกระทำแล้ว</h1>
        <p>กำลังรอให้ผู้เล่นคนอื่นทำแอคชั่นกลางคืนให้เสร็จ...</p>
        {seerResult && (
          <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
            <h3 style={{ color: 'var(--text-highlight)' }}>ผลการตรวจสอบ</h3>
            <p>ผู้เล่นคนนี้คือ <strong style={{ color: seerResult.role === 'Werewolf' ? '#ff4b4b' : '#86efac' }}>{seerResult.role}</strong>.</p>
          </div>
        )}
      </div>
    );
  }

  if (!isSpecialRole) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#45a29e' }}>ค่ำคืนได้มาเยือนแล้ว</h1>
        <p>ชาวบ้านกำลังหลับตาพักผ่อน ขอให้หลับตาไว้</p>
        <div style={{ marginTop: '2rem', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <span className="pulse-text" style={{fontSize: '2rem'}}>💤</span>
        </div>
      </div>
    );
  }

  const roleThaiMap = {
    'Werewolf': 'หมาป่า',
    'Seer': 'ผู้หยั่งรู้',
    'Doctor': 'หมอ',
    'Cupid': 'คิวปิด',
    'Villager': 'ชาวบ้าน'
  };

  return (
    <div className="glass-panel">
      <h2 style={{ textAlign: 'center', color: currentPlayer.role === 'Werewolf' ? '#ff4b4b' : 'var(--text-highlight)' }}>
        {roleThaiMap[currentPlayer.role] || currentPlayer.role} ตื่นขึ้นมา
      </h2>
      
      {currentPlayer.role === 'Werewolf' && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#ff4b4b', textAlign: 'center' }}>
          หมาป่าคนอื่นๆ: {gameState.players.filter(p => p.role === 'Werewolf' && p.id !== currentPlayer.id && p.isAlive).map(p => p.name).join(', ') || 'ไม่มี'}
        </div>
      )}

      <p className="status-message">{renderActionPrompt()}</p>
      
      <ul className="player-list">
        {otherAlivePlayers.map(p => {
          let isSelected = false;
          if (currentPlayer.role === 'Cupid') {
             isSelected = selectedTarget.includes(p.id);
          } else {
             isSelected = selectedTarget === p.id;
          }
          
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
