import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import ChatBox from './components/ChatBox';
import RoleGallery from './components/RoleGallery';
import PlayersPanel from './components/PlayersPanel';
import GameLog from './components/GameLog';
import RoleSetupPanel from './components/RoleSetupPanel';
import WerewolfRules from './components/WerewolfRules';
import GameSelect from './components/GameSelect';
import { getGameRenderer } from './games';
import { getRole } from './utils/roles';
import { playNightSound, playDaySound, playAlertSound } from './utils/sound';

const NIGHT_ROLE_ICON = { Werewolf: '🐺', Seer: '🔮', Doctor: '💉', Cupid: '💘', Witch: '🧙' };
const NIGHT_ROLE_TH = { Werewolf: 'หมาป่า', Seer: 'ผู้หยั่งรู้', Doctor: 'หมอ', Cupid: 'คิวปิด', Witch: 'แม่มด' };

// Phase → HUD label. dayNumber is filled in at render time.
const PHASE_LABELS = {
  ROLE_VIEW: { icon: '🎭', text: 'ดูบทบาท' },
  NIGHT: { icon: '🌙', text: 'คืนที่' },
  NIGHT_WITCH: { icon: '🧙', text: 'ช่วงแม่มด · คืนที่' },
  DAY: { icon: '☀️', text: 'วันที่' },
  VOTING: { icon: '🗳️', text: 'โหวต · วันที่' },
  HUNTER_REVENGE: { icon: '🏹', text: 'ล้างแค้นนายพราน' },
  END_GAME: { icon: '🏁', text: 'จบเกม' },
  // Sheriff of Nottingham
  MARKET: { icon: '🎪', text: 'ตลาด · จัดไพ่' },
  LOAD: { icon: '📦', text: 'ใส่ถุง · ประกาศสินค้า' },
  INSPECTION: { icon: '🔍', text: 'ด่านตรวจ' },
  RESOLVE: { icon: '⚖️', text: 'ผลการตรวจ' },
  SCORING: { icon: '🏆', text: 'นับคะแนน' },
};

// Does the current player have a pending action this phase? (used for the alert)
function needsMyAction(gs, me) {
  if (!gs || !me) return false;
  if (gs.phase === 'HUNTER_REVENGE') return me.id === gs.pendingHunter;
  if (!me.isAlive) return false;
  switch (gs.phase) {
    case 'NIGHT':
      // Only when it's this role's step in the sequence
      return me.role === gs.currentNightRole && !me.hasActed;
    case 'NIGHT_WITCH':
      return me.role === 'Witch' && !me.hasActed;
    case 'VOTING':
      return !me.hasVoted;
    default:
      return false;
  }
}

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
  const [publicName, setPublicName] = useState('');
  const [showGameSelect, setShowGameSelect] = useState(false);
  const [createName, setCreateName] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showRoleHelp, setShowRoleHelp] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Room code of an in-progress game the player stepped out of but can rejoin.
  const [rejoinCode, setRejoinCode] = useState(() => {
    return sessionStorage.getItem('werewolf_roomCode') || null;
  });
  const [activePanel, setActivePanel] = useState(null); // 'players' | 'log' | null
  const previousPhaseRef = useRef(null);
  const wasMyTurnRef = useRef(false);

  const currentPlayer = gameState?.players?.find(p => p.id === playerId);
  const myTurn = needsMyAction(gameState, currentPlayer);

  // Chime once when it becomes the current player's turn to act
  useEffect(() => {
    if (myTurn && !wasMyTurnRef.current) {
      playAlertSound();
    }
    wasMyTurnRef.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    const savedPlayerId = sessionStorage.getItem('werewolf_playerId');
    const savedRoomCode = sessionStorage.getItem('werewolf_roomCode');

    if (savedPlayerId && savedRoomCode) {
      socket.emit('reconnect_player', { roomCode: savedRoomCode, playerId: savedPlayerId }, (response) => {
        if (response.success) {
          setPlayerId(response.playerId);
          setGameState(response.gameState);
          setRejoinCode(null);
        } else {
          sessionStorage.removeItem('werewolf_playerId');
          sessionStorage.removeItem('werewolf_roomCode');
          setRejoinCode(null);
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
         setSeerResult(null); // clear last night's check so a new night starts fresh
      } else if (gameState.phase === 'DAY') {
         playDaySound();
      }
      previousPhaseRef.current = gameState.phase;
    }
  }, [gameState?.phase]);

  // Step 1: name entered → show the game picker
  const handleChooseGame = (name) => {
    setCreateName(name);
    setShowGameSelect(true);
  };

  // Step 2: game picked → actually create the room of that type
  const handleCreateRoom = (name, gameType = 'werewolf') => {
    socket.emit('create_room', { name, gameType }, (response) => {
      if (response.success) {
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        setShowGameSelect(false);
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

  // Generic per-game action channel (used by Sheriff and future games).
  // `payload` carries a `type` the game's handleEvent switches on.
  const handleGameAction = (payload) => {
    socket.emit('game_action', { roomCode: gameState.roomCode, ...payload });
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

  const handleLeaveRoom = () => {
    const inProgress = gameState && gameState.phase !== 'LOBBY';
    // Leaving a game in progress is reversible — warn, then keep the session so
    // the player can rejoin. Leaving the lobby is a clean, permanent exit.
    if (inProgress && !window.confirm('ออกจากเกม? ที่นั่งของคุณจะถูกเก็บไว้ กดกลับเข้ามาเล่นต่อได้ภายหลัง')) {
      return;
    }
    const code = gameState?.roomCode;
    if (gameState) {
      socket.emit('leave_room', gameState.roomCode);
    }
    setGameState(null);
    setPlayerId(null);
    setSeerResult(null);
    setNightResult([]);
    setVoteResult(null);
    setTimeRemaining(null);
    if (inProgress) {
      // Keep werewolf_playerId / werewolf_roomCode so we can reconnect; offer a button.
      setRejoinCode(code);
    } else {
      sessionStorage.removeItem('werewolf_playerId');
      sessionStorage.removeItem('werewolf_roomCode');
      setRejoinCode(null);
    }
  };

  // Return to a game the player stepped out of (or got disconnected from).
  const handleRejoin = () => {
    const pid = sessionStorage.getItem('werewolf_playerId');
    const code = sessionStorage.getItem('werewolf_roomCode');
    if (!pid || !code) { setRejoinCode(null); return; }
    socket.emit('reconnect_player', { roomCode: code, playerId: pid }, (response) => {
      if (response.success) {
        setPlayerId(response.playerId);
        setGameState(response.gameState);
        setRejoinCode(null);
        setError('');
      } else {
        setError('ไม่พบเกมเดิม (อาจจบไปแล้วหรือถูกปิด)');
        sessionStorage.removeItem('werewolf_playerId');
        sessionStorage.removeItem('werewolf_roomCode');
        setRejoinCode(null);
      }
    });
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

             {error && <p style={{ color: '#ff4b4b', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}

             <input
                type="text"
                placeholder="กรอกชื่อของคุณก่อนเข้าห้อง"
                value={publicName}
                onChange={(e) => setPublicName(e.target.value)}
                maxLength={15}
                style={{ marginBottom: '1rem' }}
             />

             {publicRooms.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '2rem 0' }}>ไม่มีห้องที่กำลังรอผู้เล่นอยู่ขณะนี้</p>
             ) : (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {publicRooms.map(r => (
                      <li key={r.roomCode} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <strong style={{ fontSize: '1.2rem', color: 'var(--text-highlight)' }}>{r.roomCode}</strong>
                            <span style={{ marginLeft: '1rem', color: '#ccc' }}>โดย: {r.hostName} ({r.playerCount}/{r.maxPlayers || 10} คน)</span>
                         </div>
                         <button
                            style={{ width: 'auto', padding: '0.5rem 1rem' }}
                            disabled={!publicName.trim()}
                            onClick={() => {
                               handleJoinRoom(r.roomCode, publicName.trim());
                               setShowPublicRooms(false);
                            }}
                         >
                            เข้าร่วม
                         </button>
                      </li>
                   ))}
                </ul>
             )}
          </div>
       );
    }

    if (showGameSelect && !gameState) {
      return <GameSelect
                playerName={createName}
                onSelect={(gameType) => handleCreateRoom(createName, gameType)}
                onBack={() => setShowGameSelect(false)}
             />;
    }

    if (!gameState) {
      return <Lobby
                onCreateRoom={handleChooseGame}
                onJoinRoom={handleJoinRoom}
                onFetchPublicRooms={fetchPublicRooms}
                onRejoin={handleRejoin}
                rejoinCode={rejoinCode}
                error={error}
             />;
    }

    // Delegate to the renderer for whichever game this room is running.
    // App stays game-agnostic: it just hands over state + handlers.
    const renderGame = getGameRenderer(gameState.gameType);
    return renderGame({
      gameState,
      currentPlayer,
      error,
      seerResult,
      nightResult,
      voteResult,
      onStartGame: startGame,
      onUpdateSettings: handleUpdateSettings,
      onKickPlayer: handleKickPlayer,
      onNightAction: handleNightAction,
      onWitchAction: handleWitchAction,
      onHunterAction: handleHunterAction,
      onVote: handleVote,
      onStartVoting: startVoting,
      onGameAction: handleGameAction,
      onPlayAgain: playAgain,
    });
  };
  const isNight = gameState?.phase === 'NIGHT';
  const totalTime = gameState?.settings?.timer || 60;

  const inGame = gameState && !isKicked && !showPublicRooms && gameState.phase !== 'LOBBY';
  const phaseLabel = gameState ? PHASE_LABELS[gameState.phase] : null;
  const dayNumber = gameState?.dayNumber || 0;
  const showsDay = ['NIGHT', 'NIGHT_WITCH', 'DAY', 'VOTING'].includes(gameState?.phase);
  const nightProgress = gameState?.nightProgress;
  const voteProgress = gameState?.voteProgress;

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
        <div style={{ position: 'fixed', top: 110, left: 20, right: 20, background: 'rgba(69, 162, 158, 0.9)', color: '#fff', padding: 15, borderRadius: 8, textAlign: 'center', zIndex: 100 }}>
          {systemMessage}
        </div>
      )}

      {gameState?.phase !== 'LOBBY' && currentPlayer?.role && (
        <div onClick={() => setShowRoleHelp(true)} title="ดูรายละเอียดบทบาทของคุณ" style={{ cursor: 'pointer', position: 'fixed', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '12px', zIndex: 90, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)' }}>
           <img
              src={`/images/${currentPlayer.isCub ? 'WolfCub' : currentPlayer.role}.png`}
              alt="Role"
              onError={(e) => { e.target.src = '/images/Werewolf.png'; }}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
           />
           <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>
              {currentPlayer.isCub ? 'ลูกหมาป่า' :
               currentPlayer.role === 'Werewolf' ? 'หมาป่า' :
               currentPlayer.role === 'Seer' ? 'ผู้หยั่งรู้' :
               currentPlayer.role === 'Doctor' ? 'หมอ' :
               currentPlayer.role === 'Fool' ? 'คนบ้า' :
               currentPlayer.role === 'Hunter' ? 'นายพราน' :
               currentPlayer.role === 'Witch' ? 'แม่มด' :
               currentPlayer.role === 'Cupid' ? 'คิวปิด' : 'ชาวบ้าน'}
           </div>
           
           {gameState.lovers && gameState.lovers.includes(currentPlayer.id) && (
              <div style={{
                  position: 'fixed', bottom: '84px', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(244, 114, 182, 0.9)', padding: '10px 20px',
                  borderRadius: '30px', boxShadow: '0 4px 15px rgba(244, 114, 182, 0.4)',
                  zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)', whiteSpace: 'nowrap'
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

      {gameState && !isKicked && !showPublicRooms && (
        <button
          onClick={handleLeaveRoom}
          style={{
            position: 'fixed', top: 20, left: 20, zIndex: 90,
            width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem',
            background: 'rgba(255, 75, 75, 0.15)', color: '#ff4b4b',
            border: '1px solid rgba(255, 75, 75, 0.5)', borderRadius: '10px',
            backdropFilter: 'blur(5px)'
          }}
        >
          ← ออกจากห้อง
        </button>
      )}

      {/* HUD: current phase / day + action progress + your-turn alert */}
      {inGame && phaseLabel && (
        <div style={{ position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 85, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', pointerEvents: 'none', maxWidth: 'calc(100vw - 220px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(5px)', fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>
            <span style={{ fontSize: '1.1rem' }}>{phaseLabel.icon}</span>
            <span>{phaseLabel.text}{showsDay ? ` ${dayNumber}` : ''}</span>
          </div>

          {gameState.phase === 'NIGHT' && gameState.currentNightRole && (
            <div style={{ fontSize: '0.75rem', color: '#ccc', background: 'rgba(0,0,0,0.5)', padding: '3px 10px', borderRadius: '12px' }}>
              {NIGHT_ROLE_ICON[gameState.currentNightRole] || '🌙'} {NIGHT_ROLE_TH[gameState.currentNightRole] || ''}กำลังทำหน้าที่
              {nightProgress && nightProgress.total > 1 ? ` (${nightProgress.done}/${nightProgress.total})` : ''}
            </div>
          )}
          {gameState.phase === 'VOTING' && voteProgress && (
            <div style={{ fontSize: '0.75rem', color: '#ccc', background: 'rgba(0,0,0,0.5)', padding: '3px 10px', borderRadius: '12px' }}>
              โหวตแล้ว {voteProgress.done}/{voteProgress.total}
            </div>
          )}
          {myTurn && (
            <div className="pulse-text" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0b0c10', background: 'var(--text-highlight)', padding: '4px 12px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(102,252,241,0.5)' }}>
              ⚡ ถึงตาคุณแล้ว!
            </div>
          )}
        </div>
      )}

      {/* Bottom-left toolbar. Role manual + players list are Werewolf-specific;
          the event log is generic (each game fills its own). */}
      {inGame && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 999, display: 'flex', gap: '8px' }}>
          {[
            ...(gameState.gameType === 'werewolf' ? [
              { key: 'rules', icon: '📖', title: 'กติกาการเล่น', onClick: () => setShowRules(true) },
              { key: 'help', icon: '❓', title: 'คู่มือบทบาท', onClick: () => setShowManual(true) },
              { key: 'roles', icon: '🎭', title: 'บทบาทในเกมรอบนี้', onClick: () => setActivePanel(activePanel === 'roles' ? null : 'roles') },
              { key: 'players', icon: '👥', title: 'รายชื่อผู้เล่น', onClick: () => setActivePanel(activePanel === 'players' ? null : 'players') },
            ] : []),
            { key: 'log', icon: '📜', title: 'บันทึกเหตุการณ์', onClick: () => setActivePanel(activePanel === 'log' ? null : 'log') },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={btn.onClick}
              title={btn.title}
              style={{
                width: '46px', height: '46px', borderRadius: '50%', padding: 0, margin: 0,
                background: (btn.key === 'roles' && activePanel === 'roles') || (btn.key === 'players' && activePanel === 'players') || (btn.key === 'log' && activePanel === 'log') ? 'var(--accent-color)' : 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)', fontSize: '1.3rem', backdropFilter: 'blur(5px)',
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Pad the content clear of the fixed top HUD and bottom toolbar during play */}
      <div style={inGame ? { paddingTop: '100px', paddingBottom: '84px' } : undefined}>
        {renderPhase()}
      </div>

      <ChatBox
        gameState={gameState}
        currentPlayer={currentPlayer}
        onSendMessage={handleSendMessage}
      />

      <PlayersPanel
        gameState={gameState}
        currentPlayer={currentPlayer}
        isOpen={inGame && activePanel === 'players'}
        onClose={() => setActivePanel(null)}
      />

      <GameLog
        gameState={gameState}
        isOpen={inGame && activePanel === 'log'}
        onClose={() => setActivePanel(null)}
      />

      <RoleSetupPanel
        gameState={gameState}
        isOpen={inGame && activePanel === 'roles'}
        onClose={() => setActivePanel(null)}
      />

      {/* In-game manual (reuses the role gallery) */}
      {showManual && (
        <div
          onClick={() => setShowManual(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <RoleGallery onBack={() => setShowManual(false)} />
          </div>
        </div>
      )}

      {showRules && <WerewolfRules gameState={gameState} onClose={() => setShowRules(false)} />}

      {/* Your-role detail popup (opened from the role badge) */}
      {showRoleHelp && currentPlayer?.role && (() => {
        const r = getRole(currentPlayer.role);
        return (
          <div
            onClick={() => setShowRoleHelp(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <div onClick={(e) => e.stopPropagation()} className="glass-panel" style={{ maxWidth: '360px', textAlign: 'center' }}>
              <img src={`/images/${currentPlayer.role}.png`} alt={r.th} style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 1rem', display: 'block', border: `2px solid ${r.color}` }} />
              <h2 style={{ color: r.color, margin: '0 0 0.25rem' }}>{r.th}</h2>
              <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem' }}>{r.faction}</p>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>{r.desc}</p>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#86efac', background: 'rgba(134,239,172,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                🎯 {r.goal}
              </p>
              <button onClick={() => setShowRoleHelp(false)}>เข้าใจแล้ว</button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default App;
