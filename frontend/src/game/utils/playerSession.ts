const LAST_LOBBY_KEY = 'lastLobbyId';
const LAST_SCENE_KEY = 'lastScene';

export function saveSession(lobbyId: string, scene: string) {
    localStorage.setItem(LAST_LOBBY_KEY, lobbyId)
    localStorage.setItem(LAST_SCENE_KEY, scene)
}

export function clearSession() {
    localStorage.removeItem(LAST_LOBBY_KEY);
    localStorage.removeItem(LAST_SCENE_KEY);
}

export function getLastSession() {
    return {
        lobbyId: localStorage.getItem(LAST_LOBBY_KEY),
        scene: localStorage.getItem(LAST_SCENE_KEY)
    }
}