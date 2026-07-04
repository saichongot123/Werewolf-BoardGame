import React from 'react';

function RoleView({ player }) {
  if (!player) return null;

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
      case 'LittleGirl':
        return 'สามารถแอบฟังแชทของหมาป่าตอนกลางคืนได้ แต่ชื่อของคุณจะถูกซ่อนไว้ (Anonymous) ระวังอย่าให้หมาป่าจับได้!';
      default:
        return '';
    }
  };

  const roleThaiMap = {
    'Werewolf': 'หมาป่า',
    'Seer': 'ผู้หยั่งรู้',
    'Doctor': 'หมอ',
    'Villager': 'ชาวบ้าน',
    'Fool': 'คนบ้า',
    'Hunter': 'นายพราน'
  };

  const roleClass = player.role ? `role-${player.role.toLowerCase()}` : '';

  return (
    <div className="glass-panel" style={{ textAlign: 'center' }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', letterSpacing: '2px' }}>บทบาทของคุณ</h3>
      
      <div className={`role-card ${roleClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
        {player.role && (
          <img 
            src={`/images/${player.role}.png`} 
            alt={player.role} 
            style={{ width: '180px', height: '180px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} 
          />
        )}
        <h2 style={{ margin: 0 }}>{roleThaiMap[player.role] || player.role}</h2>
      </div>
      
      <p style={{ lineHeight: '1.6', marginBottom: '2rem', marginTop: '1rem' }}>
        {getRoleDescription(player.role)}
      </p>
      
      <p className="pulse-text" style={{ fontSize: '0.8rem', color: '#666' }}>
        จดจำบทบาทของคุณให้ดี ค่ำคืนกำลังจะมาเยือนในไม่ช้า...
      </p>
    </div>
  );
}

export default RoleView;
