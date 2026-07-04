import React, { useState } from 'react';
import RoleGallery from './RoleGallery';

function Lobby({ gameState, currentPlayer, onCreateRoom, onJoinRoom, onStartGame, onUpdateSettings, onKickPlayer, onFetchPublicRooms, error }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  if (showGallery) {
    return <RoleGallery onBack={() => setShowGallery(false)} />;
  }

  // Initial State: User hasn't joined any room yet
  if (!gameState) {
    return (
      <div className="glass-panel">
        <h1>เกมมนุษย์หมาป่า</h1>
        <p className="status-message">เกมแห่งการหลอกลวงและการเอาชีวิตรอด</p>
        
        {error && <p style={{color: '#ff4b4b', marginBottom: '1rem', textAlign: 'center'}}>{error}</p>}
        
        <input 
          type="text" 
          placeholder="กรอกชื่อของคุณ" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          maxLength={15}
        />
        
        {isJoining ? (
          <>
            <input 
              type="text" 
              placeholder="กรอกรหัสห้อง" 
              value={roomCode} 
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <button onClick={() => onJoinRoom(roomCode, name)} disabled={!name || roomCode.length !== 4}>เข้าร่วมห้อง</button>
            <button className="secondary" onClick={() => setIsJoining(false)}>กลับ</button>
          </>
        ) : (
          <>
            <button onClick={() => onCreateRoom(name)} disabled={!name}>สร้างห้องใหม่</button>
            <button className="secondary" onClick={() => setIsJoining(true)}>เข้าร่วมห้องที่มีอยู่</button>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                className="secondary" 
                style={{ fontSize: '0.9rem', padding: '0.5rem', background: 'transparent', border: 'none', color: '#60a5fa', textDecoration: 'underline', width: 'auto', margin: '0 auto' }}
                onClick={onFetchPublicRooms}
              >
                🔍 ค้นหาห้องสาธารณะ
              </button>
              <button 
                className="secondary" 
                style={{ fontSize: '0.9rem', padding: '0.5rem', background: 'transparent', border: 'none', color: '#ccc', textDecoration: 'underline', width: 'auto', margin: '0 auto' }}
                onClick={() => setShowGallery(true)}
              >
                📖 ดูแกลเลอรีตัวละคร
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Inside a room
  return (
    <div className="glass-panel">
      <h2>รหัสห้อง: <span style={{color: '#fff', letterSpacing: '4px'}}>{gameState.roomCode}</span></h2>
      <p className="status-message">กำลังรอผู้เล่นเข้าร่วม...</p>
      
      {error && <p style={{color: '#ff4b4b'}}>{error}</p>}

      <ul className="player-list">
        {gameState.players.map(p => (
          <li key={p.id} className="player-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
               <span>{p.name} {p.id === currentPlayer?.id ? '(คุณ)' : ''}</span>
               {p.isHost && <span style={{color: 'var(--accent-color)', fontSize: '0.8rem', marginLeft: '0.5rem'}}>หัวหน้าห้อง</span>}
            </div>
            {currentPlayer?.isHost && p.id !== currentPlayer.id && (
               <button 
                  style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 75, 75, 0.2)', color: '#ff4b4b', border: '1px solid #ff4b4b' }}
                  onClick={() => onKickPlayer(p.id)}
               >
                  เตะ
               </button>
            )}
          </li>
        ))}
      </ul>

      {currentPlayer?.isHost && gameState.settings && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--text-highlight)' }}>ตั้งค่าเกม (เฉพาะหัวหน้าห้อง)</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>เวลาโหวต/หลับตา (วินาที)</label>
            <input 
              type="number" 
              value={gameState.settings.timer} 
              onChange={(e) => onUpdateSettings({ timer: parseInt(e.target.value) || 60 })}
              style={{ width: '100%', padding: '0.5rem' }}
              min={30}
              max={180}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <div 
              onClick={() => onUpdateSettings({ enableFool: !gameState.settings.enableFool })}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                borderRadius: '12px',
                background: gameState.settings.enableFool ? 'rgba(252, 211, 77, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableFool ? '#fcd34d' : 'transparent'}`,
                transition: 'all 0.3s ease',
                width: '120px',
                textAlign: 'center'
              }}
            >
              <img 
                src="/images/Fool.png" 
                alt="Fool" 
                style={{ 
                  width: '60px', height: '60px', 
                  borderRadius: '50%', objectFit: 'cover', 
                  marginBottom: '0.5rem',
                  filter: gameState.settings.enableFool ? 'none' : 'grayscale(80%)'
                }} 
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableFool ? '#fcd34d' : '#aaa' }}>
                คนบ้า (Fool)
              </span>
            </div>
            
            <div 
              onClick={() => onUpdateSettings({ enableHunter: !gameState.settings.enableHunter })}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                borderRadius: '12px',
                background: gameState.settings.enableHunter ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableHunter ? '#d8b4fe' : 'transparent'}`,
                transition: 'all 0.3s ease',
                width: '120px',
                textAlign: 'center'
              }}
            >
              <img 
                src="/images/Hunter.png" 
                alt="Hunter" 
                style={{ 
                  width: '60px', height: '60px', 
                  borderRadius: '50%', objectFit: 'cover', 
                  marginBottom: '0.5rem',
                  filter: gameState.settings.enableHunter ? 'none' : 'grayscale(80%)'
                }} 
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableHunter ? '#d8b4fe' : '#aaa' }}>
                นายพราน (Hunter)
              </span>
            </div>
            <div 
              onClick={() => onUpdateSettings({ enableWitch: !gameState.settings.enableWitch })}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '1rem', borderRadius: '12px',
                background: gameState.settings.enableWitch ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableWitch ? '#4ade80' : 'transparent'}`,
                transition: 'all 0.3s ease', width: '120px', textAlign: 'center'
              }}
            >
              <img src="/images/Witch.png" alt="Witch" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', filter: gameState.settings.enableWitch ? 'none' : 'grayscale(80%)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableWitch ? '#4ade80' : '#aaa' }}>แม่มด (Witch)</span>
            </div>

            <div 
              onClick={() => onUpdateSettings({ enableCupid: !gameState.settings.enableCupid })}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '1rem', borderRadius: '12px',
                background: gameState.settings.enableCupid ? 'rgba(244, 114, 182, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableCupid ? '#f472b6' : 'transparent'}`,
                transition: 'all 0.3s ease', width: '120px', textAlign: 'center'
              }}
            >
              <img src="/images/Cupid.png" alt="Cupid" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', filter: gameState.settings.enableCupid ? 'none' : 'grayscale(80%)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableCupid ? '#f472b6' : '#aaa' }}>คิวปิด (Cupid)</span>
            </div>

            <div 
              onClick={() => onUpdateSettings({ enableLittleGirl: !gameState.settings.enableLittleGirl })}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '1rem', borderRadius: '12px',
                background: gameState.settings.enableLittleGirl ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableLittleGirl ? '#60a5fa' : 'transparent'}`,
                transition: 'all 0.3s ease', width: '120px', textAlign: 'center'
              }}
            >
              <img src="/images/LittleGirl.png" alt="LittleGirl" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', filter: gameState.settings.enableLittleGirl ? 'none' : 'grayscale(80%)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableLittleGirl ? '#60a5fa' : '#aaa' }}>เด็กน้อย</span>
            </div>
          </div>
        </div>
      )}

      <div style={{marginTop: '2rem'}}>
        {currentPlayer?.isHost ? (
          <button 
            onClick={onStartGame} 
            disabled={gameState.players.length < 4}
            className={gameState.players.length < 4 ? '' : 'danger'}
          >
            เริ่มเกม ({gameState.players.length}/10)
          </button>
        ) : (
          <p style={{textAlign: 'center', color: '#666'}}>รอหัวหน้าห้องเริ่มเกม...</p>
        )}
        {gameState.players.length < 4 && currentPlayer?.isHost && (
          <p style={{textAlign: 'center', fontSize: '0.8rem', color: '#ff4b4b'}}>ต้องการผู้เล่นอย่างน้อย 4 คน</p>
        )}
      </div>
    </div>
  );
}

export default Lobby;
