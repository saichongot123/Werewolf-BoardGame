// utility for playing synthesized sounds using Web Audio API

let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playNightSound = () => {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime); // Low pitch
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 2); // Drops down

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 3);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const playAlertSound = () => {
  try {
    initAudio();
    // Two quick rising blips to signal "it's your turn"
    [660, 880].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = audioCtx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const playDaySound = () => {
  try {
    initAudio();
    // Play a bright major chord (C4, E4, G4)
    const freqs = [261.63, 329.63, 392.00];
    
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = f;

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1 + (i * 0.1)); // staggered attack
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + (i * 0.1));
      osc.stop(audioCtx.currentTime + 2.5);
    });
  } catch (e) {
    console.error('Audio play failed', e);
  }
};
