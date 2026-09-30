// js/audio.js - 经典诺基亚 8-bit & 现代 Web Audio 合成音效引擎

class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isBgmOn = true;
    this.masterGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmPlaying = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  toggleBgm() {
    this.isBgmOn = !this.isBgmOn;
    if (!this.isBgmOn) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    return this.isBgmOn;
  }

  // 释放下落呼啸声
  playDrop() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.28);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(200, now + 0.28);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.28);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 落地撞击重音
  playLand(quality = 1.0) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. 低频重击 (Thud)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);

      gain.gain.setValueAtTime(0.45 * quality, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.23);

      // 2. 砖石碎屑碰撞杂音 (Click/Snap)
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(1200, now);
      nFilter.Q.setValueAtTime(3, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.2, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      whiteNoise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.masterGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.05);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 完美对齐欢呼连击音效 (随着 combo 递增音阶)
  playPerfect(combo = 1) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const baseNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
      const noteIdx = Math.min(combo - 1, baseNotes.length - 1);
      const freq = baseNotes[noteIdx];

      // 双音和谐铃声
      [freq, freq * 1.5].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);

        gain.gain.setValueAtTime(0.3, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.5);
      });
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 掉落失败音效
  playMiss() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.4);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 大楼晃动嘎吱声 (Structural Creak)
  playWobble() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.15);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 实体按键音
  playClick() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 大楼倾覆轰鸣与连续碎裂撞击音效
  playCollapse() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. 低频地震轰鸣 (Deep Earthquake Rumble)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 2.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.linearRampToValueAtTime(70, now + 2.2);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 2.3);

      // 2. 连续建筑砖石崩解撞击音 (Staggered Cracks & Crashes)
      for (let i = 0; i < 5; i++) {
        const crackTime = now + 0.15 + i * 0.32 + Math.random() * 0.1;
        const cOsc = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();

        cOsc.type = 'triangle';
        cOsc.frequency.setValueAtTime(140 - i * 18, crackTime);
        cOsc.frequency.exponentialRampToValueAtTime(32, crackTime + 0.4);

        cGain.gain.setValueAtTime(0.32, crackTime);
        cGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.4);

        cOsc.connect(cGain);
        cGain.connect(this.masterGain);

        cOsc.start(crackTime);
        cOsc.stop(crackTime + 0.42);
      }
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 游戏结束旋律
  playGameOver() {
    if (this.isMuted || !this.ctx) return;
    try {
      const notes = [392, 349.23, 329.63, 293.66, 261.63]; // G4, F4, E4, D4, C4
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.16;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.22);
      });
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  // 怀旧 8-bit 背景音乐生成器 (类似经典的复古塞班手机铃声/BGM)
  startBgm() {
    if (!this.isBgmOn || this.bgmPlaying || !this.ctx) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;

    // 经典的 16 步欢乐和弦乐句
    const melody = [
      523.25, 0, 659.25, 783.99, 0, 659.25, 523.25, 0,
      587.33, 0, 698.46, 880.00, 0, 783.99, 659.25, 0
    ];
    const bass = [
      261.63, 261.63, 329.63, 329.63, 392.00, 392.00, 261.63, 261.63,
      293.66, 293.66, 349.23, 349.23, 440.00, 392.00, 329.63, 293.66
    ];

    const stepDuration = 160; // ms
    this.bgmTimer = setInterval(() => {
      if (!this.bgmPlaying || this.isMuted) return;
      try {
        const now = this.ctx.currentTime;
        const note = melody[this.bgmStep % melody.length];
        const bassNote = bass[this.bgmStep % bass.length];

        if (note > 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'pulse' in osc ? 'pulse' : 'square';
          osc.frequency.setValueAtTime(note, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.13);
        }

        if (bassNote > 0 && this.bgmStep % 2 === 0) {
          const bOsc = this.ctx.createOscillator();
          const bGain = this.ctx.createGain();
          bOsc.type = 'triangle';
          bOsc.frequency.setValueAtTime(bassNote / 2, now);
          bGain.gain.setValueAtTime(0.09, now);
          bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          bOsc.connect(bGain);
          bGain.connect(this.masterGain);
          bOsc.start(now);
          bOsc.stop(now + 0.22);
        }

        this.bgmStep++;
      } catch (e) {
        // ignore
      }
    }, stepDuration);
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const audio = new AudioManager();
