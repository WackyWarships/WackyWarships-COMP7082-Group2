import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';

type Weapon = { key: string; color: number; dmg: number; speed: number };

type HPBar = {
  width: number;
  height: number;
  set: (pct: number) => void;
  setPosition: (x: number, y: number) => void;
};

type WeaponNode = {
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  chip: Phaser.GameObjects.Arc;
};

export class Game extends Scene {
  // --- Optional compatibility properties (from the original stub) ---
  public camera!: Phaser.Cameras.Scene2D.Camera;
  public background?: Phaser.GameObjects.Image;
  public gameText?: Phaser.GameObjects.Text;

  // --- State ---
  private playerHPMax = 100;
  private enemyHPMax = 100;
  private playerHP = this.playerHPMax;
  private enemyHP = this.enemyHPMax;

  private weapons: Weapon[] = [
    { key: 'W1', color: 0x6ec1ff, dmg: 10, speed: 900 },
    { key: 'W2', color: 0x8be27e, dmg: 30, speed: 900 },
    { key: 'W3', color: 0xf6b26b, dmg: 50, speed: 900 },
    { key: 'W4', color: 0xd96df0, dmg: 80, speed: 900 }
  ];
  private currentWeaponIndex = 0;

  private coolingDown = false;
  private cooldownMs = 350;

  // Stats (used by GameOver)
  private shotsFired = 0;
  private totalDamage = 0;

  // --- Game objects you already use ---
  private bg?: Phaser.GameObjects.Image;
  private homeBtn?: Phaser.GameObjects.GameObject;
  private settingsBtn?: Phaser.GameObjects.GameObject;

  private enemy!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private enemyHPBar!: HPBar;
  private playerHPBar!: HPBar;

  private weaponNodes: WeaponNode[] = [];
  private weaponRelayout?: () => void;

  private attackBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  // -------- helpers --------
  private textureExists(key: string) {
    return this.textures?.exists(key);
  }

  private addSafeImage(
    x: number,
    y: number,
    key: string,
    opts: { w?: number; h?: number; label?: string } = {}
  ) {
    const { w = 64, h = 64, label = key } = opts;
    if (this.textureExists(key)) {
      return this.add.image(x, y, key).setOrigin(0.5);
    }
    const rect = this.add
      .rectangle(x, y, w, h, 0x000000, 0.4)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setOrigin(0.5);
    this.add
      .text(x, y, (label || key).toUpperCase(), { fontSize: '10px', color: '#fff' })
      .setOrigin(0.5);
    return rect;
  }

  private scaleShip(ship: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, W: number, H: number) {
    const s = Math.min(W / 540, H / 960) * 0.12;
    if (ship instanceof Phaser.GameObjects.Image) {
      ship.setScale(s);
    } else {
      ship.setSize(120, 40);
    }
  }

  private makeHPBar(x: number, y: number, width: number, height: number, fillColor: number): HPBar {
    const bg = this.add
      .rectangle(x, y, width, height, 0x000000, 0.45)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.65);

    const fill = this.add
      .rectangle(x - width / 2, y, width, height, fillColor)
      .setOrigin(0, 0.5);

    return {
      width,
      height,
      set: (pct: number) => {
        const clamped = Phaser.Math.Clamp(pct, 0, 1);
        fill.width = clamped * width;
      },
      setPosition: (nx: number, ny: number) => {
        bg.setPosition(nx, ny);
        fill.setPosition(nx - width / 2, ny);
      }
    };
  }

  private flyBullet(opts: {
    fromX: number;
    fromY: number;
    toY: number;
    color: number;
    duration: number;
    onImpact?: () => void;
  }) {
    const { fromX, fromY, toY, color, duration, onImpact } = opts;
    const b = this.add.circle(fromX, fromY, 6, color).setDepth(50);
    this.tweens.add({
      targets: b,
      y: toY,
      duration,
      onComplete: () => {
        b.destroy();
        onImpact && onImpact();
      }
    });
  }

  // -------- weapon UI --------
  private buildWeaponUI() {
    const { width: W, height: H } = this.scale;

    const count = 4;
    const r = 24;
    const gap = 14;
    const pad = 20;
    const x = W - (pad + r);
    const yBottom = H - (pad + r);

    // clear any existing
    this.weaponNodes.forEach(n => {
      n.circle.destroy();
      n.ring.destroy();
      n.chip.destroy();
    });
    this.weaponNodes = [];

    for (let i = 0; i < count; i++) {
      const y = yBottom - i * (r * 2 + gap);

      const circle = this.add
        .circle(x, y, r, 0x0d1a2b, 0.35)
        .setStrokeStyle(2, 0x88aaff, 0.9)
        .setDepth(200)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          this.selectWeapon(i);
        });

      const ring = this.add
        .circle(x, y, r + 3, 0x000000, 0)
        .setStrokeStyle(4, 0xffffff, 1)
        .setDepth(201)
        .setVisible(false);

      const chip = this.add.circle(x, y, 8, this.weapons[i].color).setDepth(202);

      this.weaponNodes.push({ circle, ring, chip });
    }

    this.currentWeaponIndex = 0;
    this.refreshWeaponHighlight();

    this.weaponRelayout = () => {
      const { width: W2, height: H2 } = this.scale;
      const X = W2 - (pad + r);
      const YB = H2 - (pad + r);
      this.weaponNodes.forEach((n, i) => {
        const ny = YB - i * (r * 2 + gap);
        n.circle.setPosition(X, ny);
        n.ring.setPosition(X, ny);
        n.chip.setPosition(X, ny);
      });
    };
  }

  private selectWeapon(i: number) {
    this.currentWeaponIndex = i;
    this.refreshWeaponHighlight();
  }

  private refreshWeaponHighlight() {
    if (!this.weaponNodes) return;
    this.weaponNodes.forEach((n, i) => n.ring.setVisible(i === this.currentWeaponIndex));
  }

  // -------- Phaser lifecycle --------
  create() {
    const { width: W, height: H } = this.scale;

    // assign the optional alias to main camera
    this.camera = this.cameras.main;

    // Background
    if (this.textureExists('background')) {
      this.bg = this.add.image(W / 2, H / 2, 'background').setOrigin(0.5).setDisplaySize(W, H);
      // keep the original stub alias
      this.background = this.bg;
    } else {
      this.cameras.main.setBackgroundColor(0x082a47);
    }

    // HUD
    const pad = 24;
    this.homeBtn = this.addSafeImage(pad + 24, pad + 24, 'home', { w: 56, h: 32, label: 'home' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'));

    this.settingsBtn = this.addSafeImage(W - (pad + 24), pad + 24, 'settings', {
      w: 86,
      h: 32,
      label: 'settings'
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Settings'));

    // Ships
    const topY = H * 0.2;
    const bottomY = H * 0.8;

    if (this.textureExists('enemyShip')) {
      this.enemy = this.add.image(W / 2, topY, 'enemyShip').setOrigin(0.5);
    } else if (this.textureExists('logo')) {
      this.enemy = this.add.image(W / 2, topY, 'logo').setOrigin(0.5).setFlipY(true);
    } else {
      this.enemy = this.add.rectangle(W / 2, topY, 120, 40, 0xff5555).setOrigin(0.5);
    }

    if (this.textureExists('playerShip')) {
      this.player = this.add.image(W / 2, bottomY, 'playerShip').setOrigin(0.5);
    } else if (this.textureExists('logo')) {
      this.player = this.add.image(W / 2, bottomY, 'logo').setOrigin(0.5);
    } else {
      this.player = this.add.rectangle(W / 2, bottomY, 120, 40, 0x55ff88).setOrigin(0.5);
    }

    this.scaleShip(this.enemy, W, H);
    this.scaleShip(this.player, W, H);

    // idle motion
    this.tweens.add({
      targets: this.player,
      y: bottomY - 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: this.enemy,
      y: topY + 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // HP bars
    const barW = 180, barH = 14, gap = 28;
    this.enemyHPBar = this.makeHPBar(W / 2, topY - gap, barW, barH, 0xff3b3b);
    this.playerHPBar = this.makeHPBar(W / 2, bottomY + gap, barW, barH, 0x27d35a);
    this.enemyHPBar.set(1);
    this.playerHPBar.set(1);

    // Weapons + Attack
    this.buildWeaponUI();
    this.attackBtn = this.add
      .text(W - 140, bottomY - 10, 'ATTACK', {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.doLocalAttack());

    // keep stub alias pointing at an existing Text (optional)
    this.gameText = this.attackBtn;

    EventBus.emit('current-scene-ready', this);
    this.scale.on('resize', this.onResize, this);
  }

  private doLocalAttack() {
    if (this.coolingDown || this.enemyHP <= 0 || this.playerHP <= 0) return;
    this.coolingDown = true;
    this.time.delayedCall(this.cooldownMs, () => (this.coolingDown = false));

    const w = this.weapons[this.currentWeaponIndex];
    this.shotsFired++;

    const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);

    const fromX = (this.player as any).x;
    const fromY = (this.player as any).y - 30;
    const toY   = (this.enemy  as any).y + 20;

    this.flyBullet({
      fromX,
      fromY,
      toY,
      color: w.color,
      duration,
      onImpact: () => {
        this.enemyHP = Math.max(0, this.enemyHP - w.dmg);
        this.totalDamage += w.dmg;
        this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
        if (this.enemyHP === 0) this.endRound(true);
      }
    });
  }

  private endRound(playerWon: boolean) {
    this.scene.start('GameOver', {
      result: playerWon ? 'VICTORY' : 'DEFEAT',
      playerHP: this.playerHP,
      enemyHP: this.enemyHP,
      shots: this.shotsFired,
      damage: this.totalDamage
    });
  }

  onResize(gameSize: Phaser.Structs.Size) {
    const { width: W, height: H } = gameSize;

    if (this.bg) this.bg.setPosition(W / 2, H / 2).setDisplaySize(W, H);
    if (this.background) this.background.setPosition(W / 2, H / 2).setDisplaySize(W, H);

    const pad = 24;
    (this.homeBtn as any)?.setPosition?.(pad + 24, pad + 24);
    (this.settingsBtn as any)?.setPosition?.(W - (pad + 24), pad + 24);

    const topY = H * 0.2;
    const bottomY = H * 0.8;

    (this.enemy as any)?.setPosition?.(W / 2, topY);
    (this.player as any)?.setPosition?.(W / 2, bottomY);

    this.scaleShip(this.enemy, W, H);
    this.scaleShip(this.player, W, H);

    const gap = 28;
    this.enemyHPBar?.setPosition(W / 2, topY - gap);
    this.playerHPBar?.setPosition(W / 2, bottomY + gap);

    this.weaponRelayout?.();
    this.attackBtn?.setPosition(W - 140, bottomY - 10);
    this.gameText?.setPosition(this.attackBtn.x, this.attackBtn.y); // keep alias aligned
  }
}

export default Game;
