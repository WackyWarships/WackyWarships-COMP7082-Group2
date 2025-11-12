// src/game/scenes/Game.ts
import Phaser from 'phaser';
import EventBus from '../EventBus';
import { getCenter, getResponsiveFontSize, resizeSceneBase } from '../utils/layout';
import {
  getPlayerId,
  sendDirectReady,
  sendDirectAttack,
  sendChooseWeapon,
  sendNextTurn,
} from '../../api/socket';

// -------------------------------------
// small helpers / types
// -------------------------------------
type HPBar = {
  width: number;
  height: number;
  set: (pct: number) => void;
  setPosition: (nx: number, ny: number) => void;
};
type Weapon = { key: string; color: number; dmg: number; speed: number };

// pick “the other” player for 2-player lobbies if a players list is provided
function pickOpponentId(allIds: string[], me: string): string | undefined {
  return allIds.find((id) => id !== me);
}

export class Game extends Phaser.Scene {
  public camera!: Phaser.Cameras.Scene2D.Camera;
  public background!: Phaser.GameObjects.Image;

  // ----- local battle state -----
  private playerHPMax = 100;
  private enemyHPMax = 100;
  private playerHP = this.playerHPMax;
  private enemyHP = this.enemyHPMax;

  private weapons: Weapon[] = [
    { key: 'W1', color: 0x6ec1ff, dmg: 10, speed: 900 },
    { key: 'W2', color: 0x8be27e, dmg: 30, speed: 900 },
    { key: 'W3', color: 0xf6b26b, dmg: 50, speed: 900 },
    { key: 'W4', color: 0xd96df0, dmg: 80, speed: 900 },
  ];
  private currentWeaponIndex = 0;

  private coolingDown = false;
  private cooldownMs = 350;

  private shotsFired = 0;
  private totalDamage = 0;

  // turn UI/bookkeeping
  private isPlayerTurn = true;
  private turnNumber = 1;
  private enemyTurnTimer?: Phaser.Time.TimerEvent;

  // UI refs
  private enemyHPBar!: HPBar;
  private playerHPBar!: HPBar;
  private enemy!: Phaser.GameObjects.GameObject;
  private player!: Phaser.GameObjects.GameObject;

  private homeBtn!: Phaser.GameObjects.GameObject;
  private attackBtn!: Phaser.GameObjects.Text;

  private weaponNodes: {
    circle: Phaser.GameObjects.Arc;
    ring: Phaser.GameObjects.Arc;
    chip: Phaser.GameObjects.Arc;
  }[] = [];
  private weaponRelayout?: () => void;

  private turnBadgeText!: Phaser.GameObjects.Text;
  private turnBadgeGlass!: Phaser.GameObjects.Rectangle;
  private turnLabelText!: Phaser.GameObjects.Text;
  private turnLabelGlass!: Phaser.GameObjects.Rectangle;

  private enemyHPText!: Phaser.GameObjects.Text;
  private playerHPText!: Phaser.GameObjects.Text;

  // ====== networking modes ======
  private netMode: 'local' | 'direct' | 'lobby' = 'local';

  // direct (quick-match)
  private matchId?: string;
  private offAttack?: () => void;
  private offState?: () => void;
  private seenAttackIds = new Set<string>();

  // lobby
  private lobbyId?: string;
  private turnId = 0; // authoritative turn id from server
  private starterId?: string; // who starts the game (server decides)
  private opponentId?: string; // optional: derived if players list passed in

  // identity
  private meId: string = getPlayerId();

  // de-dupe: ensure we only process each server turn once on this client
  private resolvedTurnIds = new Set<number>();

  constructor() {
    super('Game');
  }

  // -------------------------------------
  // lifecycle / init
  // -------------------------------------
  init(data: any) {
    // --- compatibility shim: accept legacy flat payloads from Lobby ---
    if (!data?.net && (data?.lobbyId || data?.starterId || data?.turnId)) {
      data = {
        net: {
          mode: 'lobby',
          lobbyId: data.lobbyId,
          starterId: data.starterId,
          turnId: data.turnId ?? 0,
          players: data.players,
        },
      };
    }
    // ------------------------------------------------------------------

    // direct (no lobby)
    if (data?.net?.mode === 'direct') {
      this.netMode = 'direct';
      this.matchId = data.net.matchId;
      this.starterId = data.net.starter;
      this.turnId = 0;
    }

    // lobby
    if (data?.net?.mode === 'lobby') {
      this.netMode = 'lobby';
      this.lobbyId = data.net.lobbyId;
      this.starterId = data.net.starterId; // whose turn the server announced first
      this.turnId = data.net.turnId ?? 0;

      // if Lobby scene passes players, we can pick an opponent id now
      if (Array.isArray(data?.net?.players)) {
        const ids: string[] = data.net.players.map((p: any) => p.playerId);
        this.opponentId = pickOpponentId(ids, this.meId);
      }
    }

    this.resetState();
  }

  private resetState() {
    this.playerHPMax = 100;
    this.enemyHPMax = 100;
    this.playerHP = this.playerHPMax;
    this.enemyHP = this.enemyHPMax;

    this.currentWeaponIndex = 0;
    this.coolingDown = false;
    this.shotsFired = 0;
    this.totalDamage = 0;

    const iStart = this.starterId ? this.starterId === this.meId : true;
    this.isPlayerTurn = iStart;
    this.turnNumber = 1;

    this.enemyTurnTimer?.remove();
    this.enemyTurnTimer = undefined;

    this.seenAttackIds.clear();
    this.resolvedTurnIds.clear();
  }

  // -------------------------------------
  // tiny utilities
  // -------------------------------------
  private textureExists(key: string) {
    return this.textures && this.textures.exists(key);
  }

  private addSafeImage(
    x: number,
    y: number,
    key: string,
    { w = 64, h = 64, label = key }: { w?: number; h?: number; label?: string } = {}
  ) {
    if (this.textureExists(key)) return this.add.image(x, y, key).setOrigin(0.5);
    const rect = this.add
      .rectangle(x, y, w, h, 0x000000, 0.4)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setOrigin(0.5);
    this.add.text(x, y, (label || key).toUpperCase(), { fontSize: '10px', color: '#fff' }).setOrigin(0.5);
    return rect;
  }

  private sizeShipByHeight(img: Phaser.GameObjects.Image, screenH: number, percentH: number) {
    const baseH = img.height || 1;
    const targetH = screenH * percentH;
    img.setScale(targetH / baseH);
  }

  private makeHPBar(x: number, y: number, width: number, height: number, fillColor: number): HPBar {
    const bg = this.add.rectangle(x, y, width, height, 0x000000, 0.45).setOrigin(0.5);
    bg.setStrokeStyle(2, 0xffffff, 0.65);
    const fill = this.add.rectangle(x - width / 2, y, width, height, fillColor).setOrigin(0, 0.5);
    return {
      width,
      height,
      set: (pct: number) => {
        fill.width = Phaser.Math.Clamp(pct, 0, 1) * width;
      },
      setPosition: (nx: number, ny: number) => {
        bg.setPosition(nx, ny);
        fill.setPosition(nx - width / 2, ny);
      },
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
    const b = this.add.circle(opts.fromX, opts.fromY, 6, opts.color).setDepth(50);
    this.tweens.add({
      targets: b,
      y: opts.toY,
      duration: opts.duration,
      onComplete: () => {
        b.destroy();
        opts.onImpact && opts.onImpact();
      },
    });
  }

  private buildWeaponUI() {
    const { width: W, height: H } = this.scale;
    const count = 4;
    const r = 24;
    const gap = 14;
    const pad = 20;
    const x = W - (pad + r);
    const yBottom = H - (pad + r);

    this.weaponNodes.forEach((n) => {
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
          p.event?.stopPropagation();
          this.selectWeapon(i);
        });

      const ring = this.add.circle(x, y, r + 3, 0x000000, 0).setStrokeStyle(4, 0xffffff, 1).setDepth(201).setVisible(false);

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

  // Map any weapon to canonical damage 10,30,50,80
  private damageForWeapon(weaponKeyOrId: string): number {
    const byKey: Record<string, number> = {
      // add aliases if your keys differ
      laser: 10,
      missile: 30,
      railgun: 50,
      nuke: 80,
      w1: 10,
      w2: 30,
      w3: 50,
      w4: 80,
      W1: 10,
      W2: 30,
      W3: 50,
      W4: 80,
    };

    if (weaponKeyOrId in byKey) return byKey[weaponKeyOrId];

    const idx = this.weapons.findIndex((w) => w.key === weaponKeyOrId);
    const table = [10, 30, 50, 80];
    if (idx >= 0) return table[Math.min(idx, table.length - 1)];

    const current = this.weapons[this.currentWeaponIndex]?.key;
    const curIdx = this.weapons.findIndex((w) => w.key === current);
    return table[Math.min(Math.max(curIdx, 0), table.length - 1)] || 10;
  }

  private selectWeapon(i: number) {
    this.currentWeaponIndex = i;
    this.refreshWeaponHighlight();
  }
  private refreshWeaponHighlight() {
    this.weaponNodes.forEach((n, i) => n.ring.setVisible(i === this.currentWeaponIndex));
  }

  private drawGlass(x: number, y: number, w: number, h: number, alpha = 0.28) {
    const glass = this.add.rectangle(x, y, w, h, 0xffffff, alpha).setOrigin(0.5);
    glass.setStrokeStyle(2, 0xffffff, 0.45);
    return glass;
  }

  private updateHPTexts() {
    if (this.enemyHPText) this.enemyHPText.setText(`${this.enemyHP} / ${this.enemyHPMax}`);
    if (this.playerHPText) this.playerHPText.setText(`${this.playerHP} / ${this.playerHPMax}`);
  }

  // -------------------------------------
  // turn helpers
  // -------------------------------------
  private setAttackEnabled(enabled: boolean) {
    this.attackBtn.setAlpha(enabled ? 1 : 0.4);
    this.attackBtn.removeAllListeners();
    if (enabled) {
      this.attackBtn.setInteractive({ useHandCursor: true }).once('pointerdown', () => this.doAttack());
    } else {
      this.attackBtn.disableInteractive();
    }
  }
  private startPlayerTurn() {
    this.isPlayerTurn = true;
    this.turnLabelText.setText('YOUR TURN').setColor('#ffffff');
    this.setAttackEnabled(true);
  }
  private startEnemyTurn() {
    this.isPlayerTurn = false;
    this.turnLabelText.setText('ENEMY TURN').setColor('#ff6969');
    this.setAttackEnabled(false);
  }
  private nextTurnBadge() {
    this.turnNumber += 1;
    this.turnBadgeText.setText(`Turn: ${this.turnNumber}`);
  }

  // -------------------------------------
  // create
  // -------------------------------------
  create() {
    const { width: W, height: H } = this.scale;
    const { x: centerX, y: centerY } = getCenter(this.scale);

    // background
    if (this.textureExists('background')) {
      this.background = this.add.image(centerX, centerY, 'background').setOrigin(0.5).setDisplaySize(W, H);
    } else {
      this.cameras.main.setBackgroundColor(0x082a47);
    }

    const pad = 24;
    this.homeBtn = this.addSafeImage(pad + 24, pad + 24, 'home', { w: 56, h: 32, label: 'home' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'));

    const topY = H * 0.2;
    const bottomY = H * 0.8;

    // enemy
    if (this.textureExists('battleshipP')) {
      const img = this.add.image(W / 2, topY, 'battleshipP').setOrigin(0.5);
      this.sizeShipByHeight(img, H, 0.09);
      this.enemy = img;
    } else {
      this.enemy = this.add.rectangle(W / 2, topY, 120, 40, 0xff5555).setOrigin(0.5);
    }

    // player
    if (this.textureExists('battleshipE')) {
      const img = this.add.image(W / 2, bottomY, 'battleshipE').setOrigin(0.5);
      this.sizeShipByHeight(img, H, 0.11);
      this.player = img;
    } else {
      this.player = this.add.rectangle(W / 2, bottomY, 120, 40, 0x55ff88).setOrigin(0.5);
    }

    // idle motion
    this.tweens.add({ targets: this.player, y: bottomY - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.enemy, y: topY + 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // HP bars
    const barW = 220, barH = 16, gap = 32;
    this.enemyHPBar = this.makeHPBar(W / 2, topY - gap, barW, barH, 0xff3b3b);
    this.playerHPBar = this.makeHPBar(W / 2, bottomY + gap, barW, barH, 0x27d35a);
    this.enemyHPBar.set(1);
    this.playerHPBar.set(1);

    // HP labels
    const hpFont = getResponsiveFontSize(W, H, 18, 14);
    this.enemyHPText = this.add
      .text(W / 2, topY - gap - 20, '', {
        fontFamily: 'Arial Black',
        fontSize: `${hpFont}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.playerHPText = this.add
      .text(W / 2, bottomY + gap + 20, '', {
        fontFamily: 'Arial Black',
        fontSize: `${hpFont}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.updateHPTexts();

    // weapon selector
    this.buildWeaponUI();

    // attack button
    this.attackBtn = this.add
      .text(W - 140, bottomY - 10, 'ATTACK', {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5);

    // turn badge + label
    const badgeW = 140, badgeH = 40;
    this.turnBadgeGlass = this.drawGlass(W - (pad + badgeW / 2), pad + 24, badgeW, badgeH);
    const badgeFont = getResponsiveFontSize(W, H, 20, 16);
    this.turnBadgeText = this.add
      .text(this.turnBadgeGlass.x, this.turnBadgeGlass.y, `Turn: ${this.turnNumber}`, {
        fontFamily: 'Arial Black',
        fontSize: `${badgeFont}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const whoW = 220, whoH = 48;
    this.turnLabelGlass = this.drawGlass(W / 2, H * 0.11, whoW, whoH, 0.28);
    const whoFont = getResponsiveFontSize(W, H, 26, 20);
    this.turnLabelText = this.add
      .text(this.turnLabelGlass.x, this.turnLabelGlass.y, 'YOUR TURN', {
        fontFamily: 'Arial Black',
        fontSize: `${whoFont}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // initial turn UI
    if (this.isPlayerTurn) this.startPlayerTurn();
    else this.startEnemyTurn();

    // networking hooks
    if (this.netMode === 'direct' && this.matchId) {
      this.wireDirect();
    } else if (this.netMode === 'lobby' && this.lobbyId) {
      this.wireLobby();
    } else {
      // local solo test
      this.setAttackEnabled(true);
    }

    // resize / cleanup
    this.scale.on('resize', this.onResize, this);
    EventBus.emit('current-scene-ready', this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup() {
    this.enemyTurnTimer?.remove();
    this.scale.off('resize', this.onResize, this);
    this.attackBtn?.removeAllListeners();
    this.offAttack && this.offAttack();
    this.offState && this.offState();
  }

  // -------------------------------------
  // networking: direct (quick-match)
  // -------------------------------------
  private wireDirect() {
    if (this.matchId) sendDirectReady(this.matchId);

    const onDirectAttack = (type: string, payload: any) => {
      if (type !== 'direct-attack') return;
      const ev = payload;
      if (!ev || ev.matchId !== this.matchId) return;

      if (ev.attackId && this.seenAttackIds.has(ev.attackId)) return;
      if (ev.attackId) this.seenAttackIds.add(ev.attackId);

      const weap = this.weapons.find((x) => x.key === ev.weaponKey) || this.weapons[0];
      // Canonical damage: 10, 30, 50, 80 (ignore server number)
      const dmg = this.damageForWeapon(weap.key);

      const { height: H2, width: W2 } = this.scale;
      const topY2 = H2 * 0.2, bottomY2 = H2 * 0.8;
      const shotFromTop = ev.playerId !== this.meId;

      this.flyBullet({
        fromX: W2 / 2,
        fromY: shotFromTop ? topY2 + 30 : bottomY2 - 30,
        toY: shotFromTop ? bottomY2 - 20 : topY2 + 20,
        color: weap.color,
        duration: 300,
        onImpact: () => {
          if (shotFromTop) {
            this.playerHP = Math.max(0, this.playerHP - dmg);
            this.playerHPBar.set(this.playerHP / this.playerHPMax);
            this.updateHPTexts();
            if (this.playerHP === 0) {
              this.endRound(false);
              return;
            }
            this.nextTurnBadge();
            this.startPlayerTurn();
          } else {
            this.enemyHP = Math.max(0, this.enemyHP - dmg);
            this.totalDamage += dmg;
            this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
            this.updateHPTexts();
            if (this.enemyHP === 0) {
              this.endRound(true);
              return;
            }
            this.nextTurnBadge();
            this.startEnemyTurn();
          }
        },
      });
    };

    EventBus.on('*', onDirectAttack as any);
    this.offAttack = () => EventBus.off('*', onDirectAttack as any);
  }

  // -------------------------------------
  // networking: lobby
  // -------------------------------------
  private wireLobby() {
    // server → turn start (authoritative)
    const onTurnStart = (evt: { turnId: number; playerId: string }) => {
      this.turnId = evt.turnId;
      // starting a new turn, clear any stale resolution mark for this id if present
      // (we only de-dupe on resolution side)
      const mine = evt.playerId === this.meId;
      if (mine) this.startPlayerTurn();
      else this.startEnemyTurn();
    };

    // server → turn resolved (animate and, if not game over, optionally ask server to rotate turn)
    const onTurnResolved = (res: {
      turnId: number;
      attackerId: string;
      defenderId: string;
      weaponId: string;
      outcome: 'success' | 'fail' | 'blocked' | 'timeout';
      damage: number;
    }) => {
      // stale or duplicate?
      if (res.turnId !== this.turnId) return;
      if (this.resolvedTurnIds.has(res.turnId)) return;
      this.resolvedTurnIds.add(res.turnId);

      const weap = this.weapons.find((w) => w.key === res.weaponId) || this.weapons[0];
      // Canonical damage: 10, 30, 50, 80
      const dmg = this.damageForWeapon(weap.key);

      const { width: W2, height: H2 } = this.scale;
      const topY = H2 * 0.2, bottomY = H2 * 0.8;
      const shotFromTop = res.attackerId !== this.meId;

      this.flyBullet({
        fromX: W2 / 2,
        fromY: shotFromTop ? topY + 30 : bottomY - 30,
        toY: shotFromTop ? bottomY - 20 : topY + 20,
        color: weap.color,
        duration: 280,
        onImpact: () => {
          if (res.attackerId === this.meId) {
            // I dealt damage to enemy
            this.enemyHP = Math.max(0, this.enemyHP - dmg);
            this.totalDamage += dmg;
            this.shotsFired += 1; // count shot when server confirms
            this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
            this.updateHPTexts();
            if (this.enemyHP === 0) {
              this.endRound(true);
              return;
            }
            // only attacker asks server to emit the next turnStart
            if (this.lobbyId) {
              sendNextTurn({ lobbyId: this.lobbyId, turnId: res.turnId, currentPlayer: res.attackerId });
            }
          } else {
            // I took damage
            this.playerHP = Math.max(0, this.playerHP - dmg);
            this.playerHPBar.set(this.playerHP / this.playerHPMax);
            this.updateHPTexts();
            if (this.playerHP === 0) {
              this.endRound(false);
              return;
            }
            // defender does NOT request next turn
          }
          this.nextTurnBadge();
        },
      });
    };

    EventBus.on('turn-start', onTurnStart as any);
    EventBus.on('turn-resolved', onTurnResolved as any);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('turn-start', onTurnStart as any);
      EventBus.off('turn-resolved', onTurnResolved as any);
    });
  }

  // -------------------------------------
  // input → attack
  // -------------------------------------
  private doAttack() {
    // lobby path (authoritative)
    if (this.netMode === 'lobby') {
      if (!this.isPlayerTurn || !this.lobbyId) return;

      const w = this.weapons[this.currentWeaponIndex];

      // defenderId is required by your server payload but not used to compute turns.
      // If Game was started without a players list, fall back to a placeholder.
      const targetId = this.opponentId ?? 'opponent';

      sendChooseWeapon({
        lobbyId: this.lobbyId,
        turnId: this.turnId,
        playerId: this.meId,
        targetPlayerId: targetId,
        weaponId: w.key,
      });

      // wait for server echo to animate; prevent double-clicks
      this.setAttackEnabled(false);
      return;
    }

    // direct/local
    if (!this.isPlayerTurn || this.coolingDown || this.enemyHP <= 0 || this.playerHP <= 0) return;

    this.coolingDown = true;
    this.time.delayedCall(this.cooldownMs, () => (this.coolingDown = false));

    const w = this.weapons[this.currentWeaponIndex];
    this.shotsFired++;

    const { width: W, height: H } = this.scale;
    const topY = H * 0.2;
    const bottomY = H * 0.8;
    const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);

    this.flyBullet({
      fromX: W / 2,
      fromY: bottomY - 30,
      toY: topY + 20,
      color: w.color,
      duration,
      onImpact: () => {
        if (this.netMode === 'direct' && this.matchId) {
          sendDirectAttack(this.matchId, w.key);
        } else {
          // local
          this.enemyHP = Math.max(0, this.enemyHP - w.dmg);
          this.totalDamage += w.dmg;
          this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
          this.updateHPTexts();
          if (this.enemyHP === 0) {
            this.endRound(true);
            return;
          }
          this.nextTurnBadge();
          this.startEnemyTurn();
        }
      },
    });
  }

  // -------------------------------------
  // resize
  // -------------------------------------
  private onResize(gameSize: Phaser.Structs.Size) {
    const { width: W, height: H } = gameSize;

    resizeSceneBase(this, W, H);

    const pad = 24;
    const topY = H * 0.2;
    const bottomY = H * 0.8;

    if (this.background) this.background.setPosition(W / 2, H / 2).setDisplaySize(W, H);
    (this.homeBtn as any)?.setPosition(pad + 24, pad + 24);

    (this.enemy as any)?.setPosition(W / 2, topY);
    (this.player as any)?.setPosition(W / 2, bottomY);

    if (this.enemy instanceof Phaser.GameObjects.Image) this.sizeShipByHeight(this.enemy as any, H, 0.09);
    if (this.player instanceof Phaser.GameObjects.Image) this.sizeShipByHeight(this.player as any, H, 0.11);

    const gap = 32;
    this.enemyHPBar?.setPosition(W / 2, topY - gap);
    this.playerHPBar?.setPosition(W / 2, bottomY + gap);

    const hpFont = getResponsiveFontSize(W, H, 18, 14);
    this.enemyHPText?.setFontSize(hpFont).setPosition(W / 2, topY - gap - 20);
    this.playerHPText?.setFontSize(hpFont).setPosition(W / 2, bottomY + gap + 20);

    this.weaponRelayout && this.weaponRelayout();
    this.attackBtn?.setPosition(W - 140, bottomY - 10);

    const badgeW = 140, badgeH = 40;
    this.turnBadgeGlass?.setPosition(W - (pad + badgeW / 2), pad + 24).setSize(badgeW, badgeH);
    const badgeFont = getResponsiveFontSize(W, H, 20, 16);
    this.turnBadgeText?.setFontSize(badgeFont).setPosition(this.turnBadgeGlass.x, this.turnBadgeGlass.y);

    const whoW = 220, whoH = 48;
    this.turnLabelGlass?.setPosition(W / 2, H * 0.11).setSize(whoW, whoH);
    const whoFont = getResponsiveFontSize(W, H, 26, 20);
    this.turnLabelText?.setFontSize(whoFont).setPosition(this.turnLabelGlass.x, this.turnLabelGlass.y);
  }

  // -------------------------------------
  // finish
  // -------------------------------------
  private endRound(playerWon: boolean) {
    this.cleanup();
    this.scene.start('GameOver', {
      result: playerWon ? 'VICTORY' : 'DEFEAT',
      playerHP: this.playerHP,
      enemyHP: this.enemyHP,
      shots: this.shotsFired,
      damage: this.totalDamage,
    });
  }
}

export default Game;
