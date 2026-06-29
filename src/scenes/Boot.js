// Boot — 预加载素材（精灵 + 音效），初始化音频
import { TILES_KEY } from '../ui.js';
import { Sound, SFX_FILES, BGM_FILE } from '../audio.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Kenney Tiny Dungeon 打包图：16x16，每行 12 个，无间距
    this.load.spritesheet(TILES_KEY, 'assets/tilemap.png', { frameWidth: 16, frameHeight: 16 });
    // Kenney CC0 音效
    for (const [key, path] of Object.entries(SFX_FILES)) this.load.audio(key, path);
    // 可选外部 BGM：存在则加载并自动用作背景乐，缺失则忽略其加载错误
    this.load.audio('bgm', BGM_FILE);
    this.load.on('loaderror', () => {}); // 忽略可选 bgm 缺失导致的 404
  }
  create() {
    Sound.init(this);
    this.scene.start('Menu');
  }
}
