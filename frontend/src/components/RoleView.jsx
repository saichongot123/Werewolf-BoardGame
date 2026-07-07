import React from 'react';
import { getRole } from '../utils/roles';

function RoleView({ player, players = [] }) {
  if (!player) return null;

  // Werewolves know their pack from the start — the server already reveals fellow
  // wolves' roles to a werewolf requester, so we can list them here.
  const packmates = player.role === 'Werewolf'
    ? players.filter(p => p.role === 'Werewolf' && p.id !== player.id)
    : [];

  // The Wolf Cub is a werewolf (role 'Werewolf') flagged isCub — show its identity.
  const isCub = !!player.isCub;
  const imageName = isCub ? 'WolfCub' : player.role;

  const getRoleDescription = (role) => {
    switch (role) {
      case 'Werewolf':
        return 'คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อกำจัดชาวบ้าน จงทำงานร่วมกับฝูงของคุณเพื่อเอาชีวิตรอด';
      case 'Seer':
        return 'คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อตรวจสอบบทบาทที่แท้จริงของผู้เล่น 1 คน';
      case 'Doctor':
        return 'คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อปกป้องผู้เล่น 1 คนจากการถูกกำจัด';
      case 'Villager':
        return 'คุณไม่มีความสามารถพิเศษใดๆ จงจับผิดและตามหาหมาป่าเพื่อโหวตพวกเขาออกในตอนกลางวัน';
      case 'Fool':
        return 'คนบ้า: คุณไม่มีเพื่อน คุณจะชนะก็ต่อเมื่อถูกโหวตออกในตอนกลางวัน! จงทำตัวให้มีพิรุธเข้าไว้';
      case 'Hunter':
        return 'หากคุณถูกฆ่าตาย (ไม่ว่าจะตอนกลางคืนหรือจากการโหวต) คุณสามารถเลือกยิงปืนใส่ผู้เล่นคนอื่นให้ตายตามไปได้ 1 คนก่อนที่คุณจะตาย';
      case 'Witch':
        return 'มีขวดยาวิเศษ 2 ขวด (ใช้ได้แค่อย่างละครั้งในเกม) ยาชุบชีวิต 1 ขวดสำหรับชุบคนที่โดนหมาป่าฆ่า และ ยาพิษ 1 ขวดสำหรับสาดใส่ใครก็ได้ให้ตายในตอนกลางคืน';
      case 'Cupid':
        return 'ในคืนแรก คุณจะได้เลือกผู้เล่น 2 คนให้ตกหลุมรักกัน หากใครคนใดคนหนึ่งตาย อีกคนจะตรอมใจตายตามไปด้วย! คู่รักจะชนะเมื่อเหลือรอดเป็นสองคนสุดท้าย';
      default:
        return '';
    }
  };

  const roleClass = player.role ? `role-${player.role.toLowerCase()}` : '';

  return (
    <div className="glass-panel" style={{ textAlign: 'center' }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', letterSpacing: '2px' }}>บทบาทของคุณ</h3>
      
      <div className={`role-card ${roleClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
        {player.role && (
          <img
            src={`/images/${imageName}.png`}
            alt={imageName}
            onError={(e) => { e.target.src = '/images/Werewolf.png'; }}
            style={{ width: '180px', height: '180px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
          />
        )}
        <h2 style={{ margin: 0 }}>{isCub ? 'ลูกหมาป่า' : getRole(player.role).th}</h2>
      </div>

      <p style={{ lineHeight: '1.6', marginBottom: '2rem', marginTop: '1rem' }}>
        {isCub
          ? 'คุณเป็นลูกหมาป่า! เล่นเหมือนหมาป่าตัวหนึ่ง แต่ถ้าคุณถูกฆ่า ฝูงหมาป่าจะแค้นและคร่าชีวิต 2 คนในคืนถัดไป'
          : getRoleDescription(player.role)}
      </p>

      {player.role === 'Werewolf' && (
        <div style={{
          marginBottom: '2rem', padding: '1rem',
          border: '1px solid #ff4b4b', borderRadius: '8px',
          background: 'rgba(255, 75, 75, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff4b4b', fontSize: '1rem' }}>🐺 ฝูงหมาป่าของคุณ</h3>
          {packmates.length > 0 ? (
            <p style={{ margin: 0, fontWeight: 'bold', color: '#fff' }}>
              {packmates.map(p => p.name).join(', ')}
            </p>
          ) : (
            <p style={{ margin: 0, color: '#ffb3b3' }}>คุณเป็นหมาป่าเพียงตัวเดียว</p>
          )}
        </div>
      )}
      
      <p className="pulse-text" style={{ fontSize: '0.8rem', color: '#666' }}>
        จดจำบทบาทของคุณให้ดี ค่ำคืนกำลังจะมาเยือนในไม่ช้า...
      </p>
    </div>
  );
}

export default RoleView;
