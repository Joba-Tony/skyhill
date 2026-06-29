// ============================================================================
// audio.js — 音频管理
//   · 音效：Kenney CC0 .ogg（在 Boot 预加载）
//   · BGM：默认程序化氛围（WebAudio，零体积）；若放入 assets/audio/music/bgm.ogg 则自动改用该曲
//   · 胜利/失败：音调正确的程序化音阶
//   · 静音状态持久化到 localStorage
// ============================================================================

export const SFX_FILES = {
  click: 'assets/audio/sfx/click.ogg',
  hit: 'assets/audio/sfx/hit.ogg',
  hurt: 'assets/audio/sfx/hurt.ogg',
  loot: 'assets/audio/sfx/loot.ogg',
  descend: 'assets/audio/sfx/descend.ogg',
  heal: 'assets/audio/sfx/heal.ogg',
  levelup: 'assets/audio/sfx/levelup.ogg',
  error: 'assets/audio/sfx/error.ogg',
};
export const BGM_FILE = 'assets/audio/music/bgm.ogg'; // 可选：放入即自动当背景乐

const MUTE_KEY = 'skyhill_muted_v1';

export const Sound = {
  scene: null,
  muted: false,
  actx: null,
  _amb: null,
  _bgm: null,
  hasMusicFile: false,

  init(scene) {
    this.scene = scene;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    this.hasMusicFile = !!(scene.cache && scene.cache.audio && scene.cache.audio.exists('bgm'));
    if (scene.sound) scene.sound.mute = this.muted;
  },

  // ---- 音效 ----
  playSfx(key, vol = 0.5) {
    if (this.muted || !this.scene || !this.scene.sound) return;
    if (this.scene.cache.audio.exists(key)) {
      try { this.scene.sound.play(key, { volume: vol }); } catch (e) {}
    }
  },

  // ---- 背景乐 ----
  startBgm() {
    if (this.muted) return;
    if (this.hasMusicFile && this.scene) {
      try {
        if (!this._bgm) this._bgm = this.scene.sound.add('bgm', { loop: true, volume: 0.35 });
        if (!this._bgm.isPlaying) this._bgm.play();
      } catch (e) {}
      return;
    }
    this._startAmbient();
  },

  _ctx() {
    if (!this.actx) { try { this.actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (this.actx.state === 'suspended') this.actx.resume();
    return this.actx;
  },

  // 程序化阴森氛围：低频失谐 pad 叠加
  _startAmbient() {
    if (this._amb) { if (this._ambMaster) this._ambMaster.gain.value = 0.05; return; }
    const ctx = this._ctx(); if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.05;
    master.connect(ctx.destination);
    this._ambMaster = master;
    const freqs = [55, 82.41, 110]; // A1 / E2 / A2
    this._amb = freqs.map((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.6 : 0.22;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 4;
      lfo.connect(lg); lg.connect(o.detune);
      o.connect(g); g.connect(master);
      o.start(); lfo.start();
      return o;
    });
  },

  // ---- 程序化提示音（胜利/失败）----
  _beep(freq, dur, type = 'triangle', vol = 0.06) {
    if (this.muted) return;
    const ctx = this._ctx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur);
  },
  winJingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._beep(f, 0.18, 'triangle', 0.06), i * 130)); },
  loseJingle() { [330, 247, 196, 147].forEach((f, i) => setTimeout(() => this._beep(f, 0.28, 'sawtooth', 0.06), i * 160)); },

  // ---- 静音 ----
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
    if (this.scene && this.scene.sound) this.scene.sound.mute = m;
    if (this._ambMaster) this._ambMaster.gain.value = m ? 0 : 0.05;
    if (this._bgm) { try { this._bgm.setVolume(m ? 0 : 0.35); } catch (e) {} }
    if (!m) this.startBgm();
  },
  toggle() { this.setMuted(!this.muted); return this.muted; },
};
