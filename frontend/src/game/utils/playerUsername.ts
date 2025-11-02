const USERNAME_KEY = 'playerName';
const PLAYER_ID_KEY = 'playerId';

export function getOrCreatePlayerId(): string {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
}

export function getStoredPlayerName(): string | null {
    return localStorage.getItem(USERNAME_KEY);
}

export function savePlayerName(name: string): void {
    localStorage.setItem(USERNAME_KEY, name);
}

export function clearPlayerName(): void {
    localStorage.removeItem(USERNAME_KEY);
}
