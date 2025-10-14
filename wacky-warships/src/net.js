// src/net.js
import { io } from 'socket.io-client';

/**
 * Very small Socket.IO wrapper for your game.
 * - Connects to VITE_WS_URL
 * - Finds a match
 * - Sends "attack" inputs
 * - Listens for: match/ready, match/state (snapshots), match/over
 */
export class Net {
  constructor() {
    this.socket = null;
    this.ready = false;

    // latest server state (you can read it if needed)
    this.state = null;

    // callbacks you can assign from Phaser scene:
    // onReady(roomInfo), onState(snapshot), onGameOver(payload), onError(err)
  }

  connect(token) {
    // IMPORTANT: define VITE_WS_URL in your .env (see notes below)
    const url = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

    this.socket = io(url, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });

    this.socket.on('connect', () => {
      this.ready = true;
      // console.log('[net] connected', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.ready = false;
      // console.log('[net] disconnected');
    });

    // server says the match is ready (room id, your id, etc.)
    this.socket.on('match/ready', (roomInfo) => {
      this.onReady && this.onReady(roomInfo);
    });

    // periodic authoritative snapshots: { players:{}, selfId, enemyId, ... }
    this.socket.on('match/state', (snapshot) => {
      this.state = snapshot;
      this.onState && this.onState(snapshot);
    });

    // final result: { result:'VICTORY'|'DEFEAT', stats:{...} }
    this.socket.on('match/over', (payload) => {
      this.onGameOver && this.onGameOver(payload);
    });

    this.socket.on('connect_error', (err) => {
      this.onError && this.onError(err);
    });
  }

  // ask server to find a match / join a room
  findMatch() {
    if (!this.ready) return;
    this.socket.emit('match/find');
  }

  // send an attack input (only the input! server decides damage/hp)
  attack(weaponIndex) {
    if (!this.ready) return;
    this.socket.emit('attack', { weapon: weaponIndex, at: Date.now() });
  }

  // optional: leave room / close
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.ready = false;
    }
  }
}
