import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  backgroundColor: "#000000",
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1000 },
      debug: false,
    },
  },
  input: {
    gamepad: true,
  },
  // requestAnimationFrame is suspended in some automated/backgrounded-tab
  // environments (browser-driven verification, headless capture), which
  // would otherwise stall the scene manager's own update loop indefinitely.
  // setTimeout keeps ticking regardless of tab visibility.
  fps: {
    forceSetTimeOut: true,
  },
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
