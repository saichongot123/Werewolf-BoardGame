import React, { useState } from 'react';
import RoleGallery from './RoleGallery';
import { getRole } from '../utils/roles';

function Lobby({ gameState, currentPlayer, onCreateRoom, onJoinRoom, onStartGame, onUpdateSettings, onKickPlayer, onFetchPublicRooms, onGameAction, onRejoin, rejoinCode, error }) {
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
        <h1>ปาร์ตี้บอร์ดเกม</h1>
        <p className="status-message">รวมเกมปาร์ตี้ เล่นสนุกกับเพื่อนได้ทุกที่</p>

        {rejoinCode && onRejoin && (
          <div style={{ marginBottom: '1rem', padding: '0.9rem', borderRadius: '12px', background: 'rgba(69,160,158,0.15)', border: '1px solid var(--accent-color)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#c8d2e8' }}>
              คุณมีเกมที่ค้างอยู่ (ห้อง <strong style={{ color: '#fff', letterSpacing: '2px' }}>{rejoinCode}</strong>)
            </p>
            <button onClick={onRejoin} style={{ background: 'var(--accent-color)', fontWeight: 'bold' }}>
              🔙 กลับเข้าเกมเดิม
            </button>
          </div>
        )}

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

      {/* Role lineup preview — visible to EVERYONE, updates with count/settings */}
      {gameState.roleSetup && gameState.roleSetup.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-highlight)', marginBottom: '0.5rem', textAlign: 'center' }}>
            🎭 บทบาทในเกมนี้ (ตัวอย่าง)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            {gameState.roleSetup.map(({ role, count }) => {
              const r = getRole(role);
              return (
                <span key={role} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem',
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${r.color}55`, color: r.color, fontWeight: 'bold',
                }}>
                  {r.th} ×{count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Balance advisory — warns (does NOT block) when the set-up would deal a
          degenerate game: roles dropped for lack of seats, or zero villagers. */}
      {gameState.balanceWarnings && gameState.balanceWarnings.length > 0 && (
        <div style={{
          marginTop: '0.75rem', padding: '0.75rem 0.9rem', borderRadius: '8px',
          background: 'rgba(220, 160, 40, 0.14)', border: '1px solid rgba(220, 160, 40, 0.55)',
        }}>
          <div style={{ fontSize: '0.82rem', color: '#f0c060', fontWeight: 'bold', marginBottom: '0.35rem' }}>
            ⚠️ สมดุลบทบาท
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#e8d9b0', lineHeight: 1.5 }}>
            {gameState.balanceWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {currentPlayer?.isHost && onGameAction && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
          <button
            style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
            disabled={gameState.players.length >= (gameState.maxPlayers || 10)}
            onClick={() => onGameAction({ type: 'add_bot' })}
          >
            🤖 เพิ่มบอท
          </button>
          <button
            className="secondary"
            style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
            disabled={!gameState.players.some(p => p.isBot)}
            onClick={() => onGameAction({ type: 'remove_bot' })}
          >
            ลบบอท
          </button>
        </div>
      )}
      {currentPlayer?.isHost && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
          เพิ่มบอทเพื่อทดลองเล่นคนเดียวได้
        </p>
      )}

      {currentPlayer?.isHost && gameState.settings && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
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
              onClick={() => onUpdateSettings({ enableWolfCub: !gameState.settings.enableWolfCub })}
              style={{
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '1rem', borderRadius: '12px',
                background: gameState.settings.enableWolfCub ? 'rgba(255, 123, 75, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${gameState.settings.enableWolfCub ? '#ff7b4b' : 'transparent'}`,
                transition: 'all 0.3s ease', width: '120px', textAlign: 'center'
              }}
            >
              <img src="/images/WolfCub.png" alt="WolfCub" onError={(e) => { e.target.src = '/images/Werewolf.png'; }} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', filter: gameState.settings.enableWolfCub ? 'none' : 'grayscale(80%)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: gameState.settings.enableWolfCub ? '#ff7b4b' : '#aaa' }}>ลูกหมาป่า</span>
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
            เริ่มเกม ({gameState.players.length}/{gameState.maxPlayers || 10})
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
