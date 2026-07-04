import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import RoleView from './components/RoleView';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';
import VotingPhase from './components/VotingPhase';
import EndGame from './components/EndGame';
import ChatBox from './components/ChatBox';
import HunterPhase from './components/HunterPhase';
import WitchPhase from './components/WitchPhase';
import { playNightSound, playDaySound } from './utils/sound';

// In development, you might want this to point to localhost:3001
// In production, it would be the deployed backend URL
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SERVER_URL);

function App() {
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  
  // Specific role action states
  const [seerResult, setSeerResult] = useState(null);
  const [nightResult, setNightResult] = useState([]);
  const [voteResult, setVoteResult] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isKicked, setIsKicked] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [showPublicRooms, setShowPublicRooms] = useState(false);
  const previousPhaseRef = useRef(null);

  const currentPlayer = gameState?.players?.find(p => p.id === playerId);

  useEffect(() => {
    const savedPlayerId = sessionStorage.getItem('werewolf_playerId');
    const savedRoomCode = sessionStorage.getItem('werewolf_roomCode');

    if (savedPlayerId && savedRoomCode) {
      socket.emit('reconnect_player', { roomCode: savedRoomCode, playerId: savedPlayerId }, (response) => {
        if (response.success) {
          setPlayerId(response.playerId);
          setGameState(response.gameState);
        } else {
          sessionStorage.removeItem('werewolf_playerId');
          sessionStorage.removeItem('werewolf_roomCode');
        }
      });
    }

    socket.on('game_state_update', (newState) => {
      setGameState(newState);
      setError('');
    });

    socket.on('error_msg', (msg) => setError(msg));
    
    socket.on('system_message', (msg) => {
      setSystemMessage(msg);
      setTimeout(() => setSystemMessage(''), 5000);
    });

    socket.on('seer_result', (result) => setSeerResult(result));
    socket.on('night_result', (result) => setNightResult(result));
    socket.on('vote_result', (eliminated) => {
      setVoteResult(eliminated);
    });
    socket.on('timer_update', (time) => setTimeRemaining(time));

    socket.on('kicked', () => {
       setIsKicked(true);
       setGameState(null);
       sessionStorage.removeItem('werewolf_playerId');
       sessionStorage.removeItem('werewolf_roomCode');
    });

    socket.on('public_rooms_list', (rooms) => {
       setPublicRooms(rooms);
    });

    return () => {
      socket.off('game_state_update');
      socket.off('error_msg');
      socket.off('system_message');
      socket.off('seer_result');
      socket.off('night_result');
      socket.off('vote_result');
      socket.off('timer_update');
    };
  }, []);

  // Audio Effects for Phase Transitions
  useEffect(() => {
    if (gameState?.phase && previousPhaseRef.current !== gameState.phase) {
      if (gameState.phase === 'NIGHT') {
         playNightSound();
      } else if (gameState.phase === 'DAY') {
         playDaySound();
      }
      previousPhaseRef.current = gameState.phase;
    }
  }, [gameState?.phase]);

  const handleCreateRoom = (name) => {
    socket.emit('create_room', name, (response) => {
      if (response.success) {
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        sessionStorage.setItem('werewolf_playerId', response.playerId);
        sessionStorage.setItem('werewolf_roomCode', response.roomCode);
      } else {
        setError(response.message);
      }
    });
  };

  const handleJoinRoom = (code, name) => {
    socket.emit('join_room', { roomCode: code, playerName: name }, (response) => {
      if (response.success) {
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        sessionStorage.setItem('werewolf_playerId', response.playerId);
        sessionStorage.setItem('werewolf_roomCode', code);
      } else {
        setError(response.message);
      }
    });
  };

  const startGame = () => {
    if (gameState) {
      socket.emit('start_game', gameState.roomCode);
    }
  };
  
  const handleNightAction = (targetId) => {
    socket.emit('night_action', { roomCode: gameState.roomCode, targetId });
  };
  
  const startVoting = () => {
    socket.emit('start_voting', gameState.roomCode);
  };
  
  const handleVote = (targetId) => {
    socket.emit('vote', { roomCode: gameState.roomCode, targetId });
  };

  const playAgain = () => {
    socket.emit('play_again', gameState.roomCode);
    setSeerResult(null);
    setNightResult([]);
    setVoteResult(null);
  };

  const handleSendMessage = (text, type) => {
    socket.emit('chat_message', { roomCode: gameState.roomCode, text, type });
  };

  const handleUpdateSettings = (settings) => {
    socket.emit('update_settings', { roomCode: gameState.roomCode, settings });
  };

  const handleKickPlayer = (targetId) => {
    socket.emit('kick_player', { roomCode: gameState.roomCode, targetId });
  };

  const fetchPublicRooms = () => {
    socket.emit('get_public_rooms');
    setShowPublicRooms(true);
  };

  const handleWitchAction = (action) => {
    socket.emit('witch_action', { roomCode: gameState.roomCode, action });
  };

  const handleHunterAction = (targetId) => {
    socket.emit('hunter_action', { roomCode: gameState.roomCode, targetId });
  };

  const renderPhase = () => {
    if (isKicked) {
       return (
          <div className="glass-panel" style={{ textAlign: 'center' }}>
             <h1 style={{ color: '#ff4b4b' }}>คุณถูกเตะออกจากห้อง!</h1>
             <p>หัวหน้าห้องได้เชิญคุณออกจากห้องแล้ว</p>
             <button onClick={() => setIsKicked(false)} style={{ marginTop: '1rem' }}>กลับหน้าแรก</button>
          </div>
       );
    }

    if (showPublicRooms) {
       return (
          <div className="glass-panel">
             <h2>ห้องสาธารณะที่เปิดอยู่</h2>
             <button className="secondary" onClick={() => setShowPublicRooms(false)} style={{ marginBottom: '1rem', width: 'auto' }}>← กลับ</button>
             {publicRooms.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '2rem 0' }}>ไม่มีห้องที่กำลังรอผู้เล่นอยู่ขณะนี้</p>
             ) : (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {publicRooms.map(r => (
                      <li key={r.roomCode} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <strong style={{ fontSize: '1.2rem', color: 'var(--text-highlight)' }}>{r.roomCode}</strong>
                            <span style={{ marginLeft: '1rem', color: '#ccc' }}>โดย: {r.hostName} ({r.playerCount}/10 คน)</span>
                         </div>
                         <button style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => {
                            setShowPublicRooms(false);
                            // We can just set error if there's no name, but let's let Lobby handle the join
                            // since Lobby needs a name. So we can't join directly if we don't have a name.
                            // Actually, just alert if no name.
                         }}>จำรหัสและกลับไปกรอก (หน้านี้สำหรับดูเท่านั้นตอนนี้)</button>
                      </li>
                   ))}
                </ul>
             )}
          </div>
       );
    }

    if (!gameState) {
      return <Lobby 
                onCreateRoom={handleCreateRoom} 
                onJoinRoom={handleJoinRoom} 
                onFetchPublicRooms={fetchPublicRooms}
                error={error} 
             />;
    }

    switch (gameState.phase) {
      case 'LOBBY':
        return <Lobby 
                  gameState={gameState} 
                  currentPlayer={currentPlayer} 
                  onStartGame={startGame}
                  onUpdateSettings={handleUpdateSettings}
                  onKickPlayer={handleKickPlayer}
                  error={error} 
               />;
      case 'ROLE_VIEW':
        return <RoleView player={currentPlayer} />;
      case 'NIGHT':
        return <NightPhase 
                  gameState={gameState} 
                  currentPlayer={currentPlayer} 
                  onAction={handleNightAction}
                  seerResult={seerResult}
               />;
      case 'NIGHT_WITCH':
        return <WitchPhase 
                  gameState={gameState} 
                  currentPlayer={currentPlayer} 
                  onWitchAction={handleWitchAction} 
               />;
      case 'DAY':
        return <DayPhase 
                  gameState={gameState} 
                  currentPlayer={currentPlayer}
                  nightResult={nightResult}
                  onStartVoting={startVoting}
                  voteResult={voteResult}
               />;
      case 'VOTING':
        return <VotingPhase 
                  gameState={gameState} 
                  currentPlayer={currentPlayer} 
                  onVote={handleVote} 
               />;
      case 'HUNTER_REVENGE':
        return <HunterPhase 
                  gameState={gameState} 
                  currentPlayer={currentPlayer} 
                  onHunterAction={handleHunterAction} 
               />;
      case 'END_GAME':
        return <EndGame 
                  gameState={gameState} 
                  currentPlayer={currentPlayer}
                  onPlayAgain={playAgain}
               />;
      default:
        return <div>Unknown Phase</div>;
    }
  };
  const isNight = gameState?.phase === 'NIGHT';
  const totalTime = gameState?.settings?.timer || 60;

  return (
    <>
      {/* Background Transition Effect */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isNight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0)',
        pointerEvents: 'none',
        transition: 'background-color 2s ease-in-out',
        zIndex: -1
      }}></div>

      {/* Timer Display */}
      {timeRemaining !== null && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '6px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          zIndex: 1000
        }}>
          <div style={{
            height: '100%',
            width: `${(timeRemaining / totalTime) * 100}%`,
            backgroundColor: timeRemaining <= 10 ? '#ff4b4b' : 'var(--accent-color)',
            transition: 'width 1s linear, background-color 0.3s ease'
          }}></div>
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', color: timeRemaining <= 10 ? '#ff4b4b' : '#fff', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {timeRemaining}s
          </div>
        </div>
      )}

      {systemMessage && (
        <div style={{ position: 'absolute', top: 30, left: 20, right: 20, background: 'rgba(69, 162, 158, 0.9)', color: '#fff', padding: 15, borderRadius: 8, textAlign: 'center', zIndex: 100 }}>
          {systemMessage}
        </div>
      )}

      {gameState?.phase !== 'LOBBY' && currentPlayer?.role && (
        <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '12px', zIndex: 90, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)' }}>
           <img 
              src={`/images/${currentPlayer.role}.png`} 
              alt="Role" 
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }} 
           />
           <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>
              {currentPlayer.role === 'Werewolf' ? 'หมาป่า' :
               currentPlayer.role === 'Seer' ? 'ผู้หยั่งรู้' :
               currentPlayer.role === 'Doctor' ? 'หมอ' : 
               currentPlayer.role === 'Fool' ? 'คนบ้า' :
               currentPlayer.role === 'Hunter' ? 'นายพราน' : 
               currentPlayer.role === 'Witch' ? 'แม่มด' : 
               currentPlayer.role === 'Cupid' ? 'คิวปิด' : 
               currentPlayer.role === 'LittleGirl' ? 'เด็กน้อย' : 'ชาวบ้าน'}
           </div>
           
           {gameState.lovers && gameState.lovers.includes(currentPlayer.id) && (
              <div style={{
                  position: 'fixed', bottom: '20px', left: '20px',
                  backgroundColor: 'rgba(244, 114, 182, 0.9)', padding: '10px 20px',
                  borderRadius: '30px', boxShadow: '0 4px 15px rgba(244, 114, 182, 0.4)',
                  zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                 <span style={{ fontSize: '1.5rem' }}>💘</span>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', color: '#fff' }}>คู่รักของคุณ:</span>
                    <strong style={{ color: '#fff' }}>
                       {gameState.players.find(p => p.id === gameState.lovers.find(id => id !== currentPlayer.id))?.name}
                    </strong>
                 </div>
              </div>
           )}
        </div>
      )}

      {renderPhase()}
      
      <ChatBox 
        gameState={gameState} 
        currentPlayer={currentPlayer} 
        onSendMessage={handleSendMessage} 
      />
    </>
  );
}

export default App;
