import React, { useState, useRef, useEffect } from 'react';

function ChatBox({ gameState, currentPlayer, onSendMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [chatType, setChatType] = useState('GLOBAL'); // GLOBAL or WEREWOLF
  const messagesEndRef = useRef(null);

  const messages = gameState?.messages || [];
  const isDead = currentPlayer && !currentPlayer.isAlive;
  const isWerewolf = currentPlayer?.role === 'Werewolf';

  // Force chat type if dead
  useEffect(() => {
    if (isDead) {
      setChatType('DEAD');
    } else if (chatType === 'DEAD') {
      setChatType('GLOBAL');
    }
  }, [isDead]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!gameState || gameState.phase === 'LOBBY') return null; // Don't show chat in lobby? Or maybe show it. Let's show it in lobby too!
  // Wait, the design: if we show it in Lobby, we can just let people chat.
  
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text, chatType);
    setText('');
  };

  const getMessageColor = (type) => {
    switch (type) {
      case 'WEREWOLF': return '#ff4b4b'; // Red
      case 'DEAD': return '#9ca3af'; // Gray
      default: return '#fff'; // White
    }
  };

  const getMessageLabel = (type) => {
    switch (type) {
      case 'WEREWOLF': return '[หมาป่า] ';
      case 'DEAD': return '[วิญญาณ] ';
      default: return '';
    }
  };

  // Prevent alive players from chatting globally during night
  const isNight = gameState.phase === 'NIGHT';
  const canChatGlobal = !isNight || isDead; // Dead players can always chat in DEAD channel (backend handles it)

  return (
    <>
      {/* Floating Toggle Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          zIndex: 999,
          fontSize: '1.5rem'
        }}
      >
        💬
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div 
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '300px',
            height: '400px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 998,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-highlight)' }}>ห้องแชท</h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', padding: '0 5px', width: 'auto', border: 'none', color: '#fff', fontSize: '1.2rem' }}>×</button>
          </div>

          {/* Chat Tabs for Werewolf */}
          {isWerewolf && !isDead && (
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <button 
                onClick={() => setChatType('GLOBAL')} 
                style={{ flex: 1, padding: '5px', fontSize: '0.8rem', backgroundColor: chatType === 'GLOBAL' ? 'rgba(69, 162, 158, 0.5)' : 'rgba(255,255,255,0.1)' }}
              >
                คุยรวม
              </button>
              <button 
                onClick={() => setChatType('WEREWOLF')} 
                style={{ flex: 1, padding: '5px', fontSize: '0.8rem', backgroundColor: chatType === 'WEREWOLF' ? 'rgba(255, 75, 75, 0.5)' : 'rgba(255,255,255,0.1)' }}
              >
                หมาป่า
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px', marginBottom: '10px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#666', marginTop: 'auto', marginBottom: 'auto' }}>ไม่มีข้อความ</div>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ 
                alignSelf: m.senderId === currentPlayer?.id ? 'flex-end' : 'flex-start',
                backgroundColor: m.senderId === currentPlayer?.id ? 'rgba(69, 162, 158, 0.3)' : 'rgba(255,255,255,0.1)',
                padding: '8px 12px',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${m.senderId === currentPlayer?.id ? 'rgba(69, 162, 158, 0.5)' : 'rgba(255,255,255,0.2)'}`
              }}>
                {m.senderId !== currentPlayer?.id && (
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: '2px' }}>{m.senderName}</div>
                )}
                <div style={{ fontSize: '0.9rem', color: getMessageColor(m.type), wordBreak: 'break-word' }}>
                  <span style={{fontWeight: 'bold'}}>{getMessageLabel(m.type)}</span>{m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="text" 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isDead ? "คุยกับคนตายด้วยกัน..." : 
                chatType === 'WEREWOLF' ? "คุยกับหมาป่า..." : 
                !canChatGlobal ? "คุยรวมไม่ได้ในตอนกลางคืน" : "พิมพ์ข้อความ..."
              }
              disabled={!isDead && !canChatGlobal && chatType === 'GLOBAL'}
              style={{ flex: 1, padding: '8px', fontSize: '0.9rem', marginBottom: 0 }}
            />
            <button 
              type="submit" 
              disabled={!text.trim() || (!isDead && !canChatGlobal && chatType === 'GLOBAL')}
              style={{ padding: '8px 12px', width: 'auto', marginBottom: 0 }}
            >
              ส่ง
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBox;
