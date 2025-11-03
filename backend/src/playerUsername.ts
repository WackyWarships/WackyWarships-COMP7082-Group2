import { Server, Socket } from "socket.io";
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    PlayerId,
    SetUsernameEvent,
    UsernameSetEvent,
} from "../../shared/types.js";

// Server only player record
type PlayerRecord = {
    playerId: PlayerId;
    playerName: string;
    createdAt: number;
    lastSeen: number;
};

const playerMap = new Map<PlayerId, PlayerRecord>();

export function getPlayerMap() {
    return playerMap;
}

export function setupSocket(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket
) {
    // Handle username registration or update
    socket.on("setUsername", (payload: SetUsernameEvent) => {
        const { playerId, playerName } = payload;
        const now = Date.now();
        let restored = false;

        const existing = playerMap.get(playerId);

        if (existing) {
            existing.playerName = playerName;
            existing.lastSeen = now;
            restored = true;
            console.log(`🔁 Updated player name: ${playerName} (${playerId})`);
        } else {
            const newPlayer: PlayerRecord = {
                playerId,
                playerName,
                createdAt: now,
                lastSeen: now,
            };
            playerMap.set(playerId, newPlayer);
            console.log(`🆕 Registered new player: ${playerName} (${playerId})`);
        }

        const response: UsernameSetEvent = {
            playerId,
            playerName,
            restored,
        };

        socket.emit("usernameSet", response);
    });

    socket.on("disconnect", (reason) => {
        console.log(`Player disconnected: ${socket.id} (${reason})`);
    });
}
