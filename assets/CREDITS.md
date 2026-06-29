# 素材致谢 / Asset Credits

## 图像 Sprites
- **Kenney — Tiny Dungeon**（`assets/tilemap.png`）
  - 作者 / Author: Kenney (https://kenney.nl)
  - 许可 / License: **CC0 1.0 Universal**（公共领域，可商用、可修改，署名非强制）
  - 来源 / Source: https://kenney.nl/assets/tiny-dungeon
  - 原始许可文本见 `assets/kenney_tiny_dungeon_LICENSE.txt`
  - 说明：16×16 像素打包图，每行 12 个、无间距；游戏以帧号引用。

## 音效 Audio（全部 **Kenney CC0**，见 https://kenney.nl）
位于 `assets/audio/sfx/`：
- `click.ogg` ← Kenney *Interface Sounds*（click_004）
- `heal.ogg` ← Kenney *Interface Sounds*（confirmation_003）
- `error.ogg` ← Kenney *Interface Sounds*（error_002）
- `hit.ogg` ← Kenney *RPG Audio*（knifeSlice）
- `loot.ogg` ← Kenney *RPG Audio*（handleCoins2）
- `descend.ogg` ← Kenney *RPG Audio*（footstep05）
- `hurt.ogg` ← Kenney *Impact Sounds*（impactPunch_medium_003）
- `levelup.ogg` ← Kenney *Music Jingles*（8-Bit / NES00）

许可：CC0 1.0（公共领域，可商用、可修改，署名非强制）。

## 背景乐 BGM
- 默认：**程序化氛围**（WebAudio 低频失谐 pad，见 `src/audio.js`），零素材。
- 胜利/失败：程序化音阶提示音。
- 可选外部曲目：把任意 CC0 循环放到 `assets/audio/music/bgm.ogg`，游戏会自动改用它作背景乐。

## 引擎 Engine
- **Phaser 3.80.1**（`vendor/phaser.min.js`），MIT 许可，https://phaser.io
