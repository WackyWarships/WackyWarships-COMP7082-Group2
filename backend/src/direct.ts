import type { Server, Socket } from "socket.io";
import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "../../shared/types.js";

/** canonical weapon damage table (server-authoritative) */
const CANON_WEAPON_DAMAGE: Record<string, number> = {
    W1: 10,
    W2: 30,
    W3: 50,
    W4: 80,
};

type MatchId = string;
type PlayerId = string;

type Peer = { socketId: string; playerId: PlayerId; username?: string; ready: boolean };

type Match = {
    id: MatchId;
    a?: Peer;        // host or first queued
    b?: Peer;        // guest or second queued
    starter?: PlayerId;
    started: boolean;
};

// --- state ---
const waitingQueue: PlayerId[] = [];
const socketByPlayer = new Map<PlayerId, Socket>();
const playerBySocket = new Map<string, PlayerId>();
const matchById = new Map<MatchId, Match>();

function makeId(prefix = "match"): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateMatch(matchId: MatchId): Match {
    let m = matchById.get(matchId);
    if (!m) {
        m = { id: matchId, started: false };
        matchById.set(matchId, m);
    }
    return m;
}

function emitFound(io: Server, match: Match) {
    const payloadBasic = {
        matchId: match.id,
        players: [match.a?.playerId, match.b?.playerId].filter(Boolean),
        starter: match.starter,
    };

    // Old names (queue flow)
    if (match.a?.socketId) io.to(match.a.socketId).emit("directMatchFound", payloadBasic);
    if (match.b?.socketId) io.to(match.b.socketId).emit("directMatchFound", payloadBasic);

    // New colon names
    const payloadColon = {
        matchId: match.id,
        host: match.a ? { playerId: match.a.playerId, username: match.a.username } : undefined,
        guest: match.b ? { playerId: match.b.playerId, username: match.b.username } : undefined,
        starter: match.starter,
    };
    if (match.a?.socketId) io.to(match.a.socketId).emit("direct:found", payloadColon);
    if (match.b?.socketId) io.to(match.b.socketId).emit("direct:found", payloadColon);
}

function emitState(io: Server, to: string | string[], state: any) {
    const targets = Array.isArray(to) ? to : [to];
    for (const t of targets) {
        io.to(t).emit("directState", state);  // old
        io.to(t).emit("direct:state", state); // colon
    }
}

/** single authoritative attack emit (colon only) + unique attackId */
function relayAttack(
    io: Server,
    toSocketId: string | string[],
    msg: { matchId: string; playerId: string; weaponKey: string; damage: number; serverTime: number; attackId: string }
) {
    const targets = Array.isArray(toSocketId) ? toSocketId : [toSocketId];
    for (const sid of targets) {
        // IMPORTANT: only emit the colon version to avoid duplicates client-side
        io.to(sid).emit("direct:attack", msg);
    }
}

export function setupDirectSocket(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
) {
    // Map playerId <-> socket as soon as we know it
    socket.on("setUsername", ({ playerId }) => {
        if (!playerId) return;
        socketByPlayer.set(playerId, socket);
        playerBySocket.set(socket.id, playerId);
    });

    // =======================
    // QUEUE FLOW (kept)
    // =======================

    socket.on("directQueue", ({ playerId }) => {
        if (!playerId) return;
        socketByPlayer.set(playerId, socket);
        playerBySocket.set(socket.id, playerId);

        if (!waitingQueue.includes(playerId)) waitingQueue.push(playerId);

        while (waitingQueue.length >= 2) {
            const aId = waitingQueue.shift()!;
            const bId = waitingQueue.shift()!;
            if (!aId || !bId) break;

            const matchId = makeId();
            const match: Match = {
                id: matchId,
                a: { socketId: socketByPlayer.get(aId)?.id || "", playerId: aId, ready: false },
                b: { socketId: socketByPlayer.get(bId)?.id || "", playerId: bId, ready: false },
                starter: Math.random() < 0.5 ? aId : bId,
                started: false,
            };
            matchById.set(matchId, match);

            socketByPlayer.get(aId)?.join(matchId);
            socketByPlayer.get(bId)?.join(matchId);

            emitFound(io, match);
        }
    });

    socket.on("directReady", ({ matchId, playerId }) => {
        const m = matchById.get(matchId);
        if (!m) return;
        if (m.a?.playerId === playerId) m.a.ready = true;
        if (m.b?.playerId === playerId) m.b.ready = true;

        const sids = [m.a?.socketId, m.b?.socketId].filter(Boolean) as string[];
        emitState(io, sids, { matchId, readyFor: playerId });

        if (!m.started && m.a?.ready && m.b?.ready) {
            m.started = true;
            if (!m.starter) m.starter = m.a.playerId;
            emitState(io, sids, { matchId, started: true, starter: m.starter });
        }
    });

    socket.on("directAttack", ({ matchId, playerId, weaponKey }) => {
        const m = matchById.get(matchId);
        if (!m || !m.a || !m.b) return;

        const damage = CANON_WEAPON_DAMAGE[weaponKey] ?? 10;
        const serverTime = Date.now();
        const attackId = `${matchId}:${playerId}:${serverTime}`;

        // send to BOTH players (authoritative echo)
        relayAttack(io, [m.a.socketId, m.b.socketId], { matchId, playerId, weaponKey, damage, serverTime, attackId });
    });

    // ===================================
    // EXPLICIT HOST/JOIN (colon versions)
    // ===================================
    // NOTE: These event names are not in ClientToServerEvents; handle with `as any`
    // and avoid parameter destructuring to silence implicit-any diagnostics.

    (socket as any).on("direct:host", (payload: any) => {
        const matchId: string | undefined = payload?.matchId;
        const playerId: string | undefined = payload?.playerId;
        const username: string | undefined = payload?.username;
        if (!playerId) return;

        socketByPlayer.set(playerId, socket);
        playerBySocket.set(socket.id, playerId);

        const id = matchId || makeId();
        const m = getOrCreateMatch(id);
        m.a = { socketId: socket.id, playerId, username, ready: false };
        if (!m.starter) m.starter = playerId;

        socket.join(id);
        emitState(io, socket.id, { matchId: id, role: "host" });
        if (m.b) emitFound(io, m);
    });

    (socket as any).on("direct:join", (payload: any) => {
        const matchId: string | undefined = payload?.matchId;
        const playerId: string | undefined = payload?.playerId;
        const username: string | undefined = payload?.username;
        if (!playerId || !matchId) return;

        socketByPlayer.set(playerId, socket);
        playerBySocket.set(socket.id, playerId);

        const m = getOrCreateMatch(matchId);
        m.b = { socketId: socket.id, playerId, username, ready: false };
        socket.join(matchId);

        emitFound(io, m);
        if (m.a?.socketId) emitState(io, m.a.socketId, { matchId, role: "host" });
        if (m.b?.socketId) emitState(io, m.b.socketId, { matchId, role: "guest" });
    });

    (socket as any).on("direct:ready", (payload: any) => {
        const matchId: string | undefined = payload?.matchId;
        const playerId: string | undefined = payload?.playerId;
        if (!matchId || !playerId) return;

        const m = matchById.get(matchId);
        if (!m) return;

        if (m.a?.playerId === playerId) m.a.ready = true;
        if (m.b?.playerId === playerId) m.b.ready = true;

        const sids = [m.a?.socketId, m.b?.socketId].filter(Boolean) as string[];
        emitState(io, sids, { matchId, readyFor: playerId });

        if (!m.started && m.a?.ready && m.b?.ready) {
            m.started = true;
            // safe fallback to avoid "possibly undefined"
            if (!m.starter) m.starter = m.a?.playerId ?? m.b?.playerId ?? playerId;
            emitState(io, sids, { matchId, started: true, starter: m.starter });
        }
    });

    (socket as any).on("direct:attack", (payload: any) => {
        const matchId: string | undefined = payload?.matchId;
        const playerId: string | undefined = payload?.playerId;
        const weaponKey: string | undefined = payload?.weaponKey;
        if (!matchId || !playerId || !weaponKey) return;

        const m = matchById.get(matchId);
        if (!m || !m.a || !m.b) return;

        const damage = CANON_WEAPON_DAMAGE[weaponKey] ?? 10;
        const serverTime = Date.now();
        const attackId = `${matchId}:${playerId}:${serverTime}`;

        // send to BOTH players (authoritative echo)
        relayAttack(io, [m.a.socketId, m.b.socketId], {
            matchId,
            playerId,
            weaponKey,
            damage,
            serverTime,
            attackId,
        });
    });

    // ---------- cleanup ----------
    socket.on("disconnect", () => {
        const pid = playerBySocket.get(socket.id);
        if (!pid) return;
        playerBySocket.delete(socket.id);
        socketByPlayer.delete(pid);

        const idx = waitingQueue.indexOf(pid);
        if (idx >= 0) waitingQueue.splice(idx, 1);
    });
}
