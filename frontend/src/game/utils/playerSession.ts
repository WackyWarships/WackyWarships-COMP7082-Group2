import type { PlayerSession } from 'shared/types';

const SESSION_KEY = 'playerSession';

export function saveSession(session: PlayerSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getLastSession(): PlayerSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
}

export function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
}