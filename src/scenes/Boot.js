// Boot — 预加载素材
import { TILES_KEY } from '../ui.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Kenney Tiny Dungeon 打包图：16x16，每行 12 个，无间距
    this.load.spritesheet(TILES_KEY, 'assets/tilemap.png', { frameWidth: 16, frameHeight: 16 });
  }
  create() { this.scene.start('Menu'); }
}
