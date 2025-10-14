// src/game/scenes/Game.js
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene {
  constructor() {
    super('Game');
  }

  // ------------- small helpers -------------
  textureExists(key) {
    return this.textures && this.textures.exists(key);
  }

  addSafeImage(x, y, key, { w = 64, h = 64, label = key } = {}) {
    if (this.textureExists(key)) return this.add.image(x, y, key).setOrigin(0.5);
    const rect = this.add.rectangle(x, y, w, h, 0x000000, 0.4)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setOrigin(0.5);
    this.add.text(x, y, (label || key).toUpperCase(), { fontSize: 10, color: '#fff' }).setOrigin(0.5);
    return rect;
  }

  startIfSceneExists(key, fallbackKey = 'MainMenu') {
    const exists = !!this.scene?.manager?.keys?.[key];
    this.scene.start(exists ? key : fallbackKey);
  }

  scaleShip(ship, W, H) {
    const s = Math.min(W / 540, H / 960) * 0.12;
    if (ship.texture) ship.setScale(s);
    else ship.setSize(120, 40);
  }

  // simple HP bar (bg + fill)
  makeHPBar(x, y, width, height, fillColor) {
    const bg   = this.add.rectangle(x, y, width, height, 0x000000, 0.45).setOrigin(0.5);
    bg.setStrokeStyle(2, 0xffffff, 0.65);
    const fill = this.add.rectangle(x - width/2, y, width, height, fillColor).setOrigin(0, 0.5);

    return {
      width, height,
      set: (pct) => { fill.width = Phaser.Math.Clamp(pct, 0, 1) * width; },
      setPosition: (nx, ny) => { bg.setPosition(nx, ny); fill.setPosition(nx - width/2, ny); }
    };
  }

  // ------------- weapon UI -------------
  buildWeaponUI() {
    const { width: W, height: H } = this.scale;
    const count = 4, r = 24, gap = 14, edgePad = 20;
    const x = W - (edgePad + r);
    const yBottom = H - (edgePad + r);

    // remove old nodes if any
    this.weaponNodes?.forEach(n => (n.circle.destroy(), n.ring.destroy()));
    this.weaponNodes = [];

    for (let i = 0; i < count; i++) {
      const y = yBottom - i * (r * 2 + gap);

      const circle = this.add.circle(x, y, r, 0x000000, 0.35)
        .setStrokeStyle(2, 0x88aaff, 0.8)
        .setDepth(200)
        .setInteractive({ useHandCursor: true });

      const ring = this.add.circle(x, y, r + 3, 0x000000, 0)
        .setStrokeStyle(4, 0xffffff, 1)
        .setVisible(false)
        .setDepth(201);

      circle.on('pointerdown', (p) => {
        p.event.stopPropagation();
        this.selectWeapon(i);
      });

      this.weaponNodes.push({ circle, ring });
    }

    // default selection
    this.currentWeaponIndex = 0;
    this.refreshWeaponHighlight();

    // provide relayout for resize
    const relayout = () => {
      const { width: W2, height: H2 } = this.scale;
      const x2 = W2 - (edgePad + r);
      const yB = H2 - (edgePad + r);
      this.weaponNodes.forEach((n, i) => {
        const ny = yB - i * (r * 2 + gap);
        n.circle.setPosition(x2, ny);
        n.ring.setPosition(x2, ny);
      });
    };

    // chain with any previous relayout
    const prev = this.weaponRelayout;
    this.weaponRelayout = () => {
      prev && prev();
      relayout();
    };
  }

  selectWeapon(index) {
    this.currentWeaponIndex = index;
    this.refreshWeaponHighlight();
  }

  refreshWeaponHighlight() {
    if (!this.weaponNodes) return;
    this.weaponNodes.forEach((n, i) => n.ring.setVisible(i === this.currentWeaponIndex));
  }

  // projectile animation with callback when it "lands"
  spawnPredictedProjectile(onImpact) {
    const bullet = this.add.circle(this.player.x, this.player.y - 30, 6, 0xffffff).setDepth(300);

    this.tweens.add({
      targets: bullet,
      y: this.enemy.y + 20,
      duration: 300,               // flight time (ms)
      ease: 'Sine.inOut',
      onComplete: () => {
        bullet.destroy();
        if (onImpact) onImpact();  // trigger hit effect when it reaches
      }
    });
  }

  // ------------- main -------------
  create() {
    // adopt any global net
    this.net = this.net || (typeof window !== 'undefined' ? window.net : undefined);

    // basic state
    this.playerHPMax = 100;
    this.enemyHPMax  = 100;
    this.playerHP = this.playerHPMax;
    this.enemyHP  = this.enemyHPMax;
    this.totalDamage = 0;
    this.shotsFired  = 0;
    this.isFiring = false;

    const { width: W, height: H } = this.scale;

    // background
    if (this.textureExists('background')) {
      this.bg = this.add.image(W/2, H/2, 'background').setOrigin(0.5).setDisplaySize(W, H);
    } else {
      this.cameras.main.setBackgroundColor(0x082a47);
      this.bg = null;
    }

    // HUD buttons
    const pad = 24;
    this.homeBtn = this.addSafeImage(pad + 24, pad + 24, 'home', { w: 56, h: 32, label: 'home' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'));

    this.settingsBtn = this.addSafeImage(W - (pad + 24), pad + 24, 'settings', { w: 86, h: 32, label: 'settings' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.startIfSceneExists('Settings', 'MainMenu'));

    // ships
    const topY = H * 0.20;
    const bottomY = H * 0.80;

    // enemy
    if (this.textureExists('enemyShip')) {
      this.enemy = this.add.image(W/2, topY, 'enemyShip').setOrigin(0.5);
    } else if (this.textureExists('logo')) {
      this.enemy = this.add.image(W/2, topY, 'logo').setOrigin(0.5).setFlipY(true);
    } else {
      this.enemy = this.add.rectangle(W/2, topY, 120, 40, 0xff5555).setOrigin(0.5);
    }

    // player
    if (this.textureExists('playerShip')) {
      this.player = this.add.image(W/2, bottomY, 'playerShip').setOrigin(0.5);
    } else if (this.textureExists('logo')) {
      this.player = this.add.image(W/2, bottomY, 'logo').setOrigin(0.5);
    } else {
      this.player = this.add.rectangle(W/2, bottomY, 120, 40, 0x55ff88).setOrigin(0.5);
    }

    this.scaleShip(this.enemy, W, H);
    this.scaleShip(this.player, W, H);

    // idle tweens
    this.tweens.add({ targets: this.player, y: bottomY - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.enemy,  y: topY + 10,    duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // HP bars
    const barW = 180, barH = 14, hpGap = 28;
    this.enemyHPBar  = this.makeHPBar(W/2, topY    - hpGap, barW, barH, 0xff3b3b);
    this.playerHPBar = this.makeHPBar(W/2, bottomY + hpGap, barW, barH, 0x27d35a);
    this.enemyHPBar.set(1);
    this.playerHPBar.set(1);

    // weapon selector
    this.buildWeaponUI();

    // ---------- ATTACK button (offline fallback) ----------
    const r = 24, edgePad = 20, cx = W - (edgePad + r);
    const topOfStackY = H - (edgePad + r) - 4 * (r * 2 + 14);

    this.attackBtnBg = this.add.rectangle(cx, topOfStackY - 22, 110, 36, 0x1d2340, 0.85)
      .setOrigin(0.5)
      .setDepth(210)
      .setStrokeStyle(2, 0xffffff, 0.7);

    this.attackBtn = this.add.text(cx, topOfStackY - 22, 'ATTACK', {
      fontFamily: 'Arial Black',
      fontSize: 18,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(211);

    this.attackBtnBg.setInteractive({ useHandCursor: true });

    const OFFLINE_DMG = [10, 30, 50, 80];

    const doLocalAttack = () => {
      const dmg = OFFLINE_DMG[this.currentWeaponIndex] ?? 10;

      // fire projectile
      this.spawnPredictedProjectile(() => {
        this.enemyHP = Math.max(0, this.enemyHP - dmg);
        this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
        this.totalDamage += dmg;
        this.shotsFired += 1;

        // optional small "hit flash"
        this.tweens.add({
          targets: this.enemy,
          alpha: { from: 0.5, to: 1 },
          duration: 120,
          ease: 'Quad.easeOut'
        });

        if (this.enemyHP <= 0) {
          this.time.delayedCall(300, () => {
            this.scene.start('GameOver', {
              result: 'VICTORY',
              playerHP: this.playerHP,
              enemyHP: this.enemyHP,
              shots: this.shotsFired,
              damage: this.totalDamage
            });
          });
        }
      });
    };

    this.attackBtnBg.on('pointerdown', () => {
      if (this.isFiring) return;

      if (this.net?.ready) {
        // online
        this.isFiring = true;
        this.shotsFired += 1;
        try {
          this.net.attack(this.currentWeaponIndex);
        } catch {}
        this.spawnPredictedProjectile();
        this.time.delayedCall(300, () => (this.isFiring = false));
      } else {
        // offline
        doLocalAttack();
      }
    });

    // wire resize
    this.scale.on('resize', this.onResize, this);

    EventBus.emit('current-scene-ready', this);
  }

  onResize(gameSize) {
    const { width: W, height: H } = gameSize;

    if (this.bg) this.bg.setPosition(W/2, H/2).setDisplaySize(W, H);

    const pad = 24;
    this.homeBtn?.setPosition(pad + 24, pad + 24);
    this.settingsBtn?.setPosition(W - (pad + 24), pad + 24);

    const topY = H * 0.20;
    const bottomY = H * 0.80;

    this.enemy?.setPosition(W/2, topY);
    this.player?.setPosition(W/2, bottomY);

    this.scaleShip?.(this.enemy, W, H);
    this.scaleShip?.(this.player, W, H);

    const hpGap = 28;
    this.enemyHPBar?.setPosition(W/2, topY - hpGap);
    this.playerHPBar?.setPosition(W/2, bottomY + hpGap);

    // reposition weapon circles + attack button
    const r = 24, edgePad = 20, cx = W - (edgePad + r);
    const topOfStackY = H - (edgePad + r) - 4 * (r * 2 + 14);
    this.attackBtn?.setPosition(cx, topOfStackY - 22);
    this.attackBtnBg?.setPosition(cx, topOfStackY - 22);

    this.weaponRelayout?.();
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
