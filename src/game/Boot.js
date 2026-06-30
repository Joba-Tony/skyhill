// Boot — 生成程序化贴图、加载音效，进入主菜单
import { makeTextures } from './textures.js';
import { SFX_FILES, Sfx } from './sfx.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    for (const [k, p] of Object.entries(SFX_FILES)) this.load.audio(k, p);
    this.load.on('loaderror', () => {});
  }
  create() {
    makeTextures(this);
    Sfx.init(this);
    this.scene.start('Menu');
  }
}
