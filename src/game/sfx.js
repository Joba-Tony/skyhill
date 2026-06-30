// sfx.js — 轻量音效（复用 assets/audio/sfx 里的 Kenney CC0 .ogg），带节流防刷屏
export const SFX_FILES = {
  shoot: 'assets/audio/sfx/click.ogg',
  hit: 'assets/audio/sfx/hit.ogg',
  hurt: 'assets/audio/sfx/hurt.ogg',
  pickup: 'assets/audio/sfx/loot.ogg',
  levelup: 'assets/audio/sfx/levelup.ogg',
};

export const Sfx = {
  scene: null, muted: false, _last: {},
  init(scene) {
    this.scene = scene;
    try { this.muted = localStorage.getItem('mw_muted') === '1'; } catch (e) {}
    if (scene.sound) scene.sound.mute = this.muted;
  },
  play(key, vol = 0.5, throttle = 0) {
    if (this.muted || !this.scene || !this.scene.sound) return;
    if (throttle) { const n = Date.now(); if (n - (this._last[key] || 0) < throttle) return; this._last[key] = n; }
    if (this.scene.cache.audio.exists(key)) { try { this.scene.sound.play(key, { volume: vol }); } catch (e) {} }
  },
  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('mw_muted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.scene && this.scene.sound) this.scene.sound.mute = this.muted;
    return this.muted;
  },
};
