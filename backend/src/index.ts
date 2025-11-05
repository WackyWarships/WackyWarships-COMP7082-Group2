import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';

import { getLobbyMap, setupSocket as setupLobbySocket } from "./lobby.js";
import { setupSocket as setupPlayerUsernameSocket } from "./playerUsername.js";

import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../../shared/types.js";

dotenv.config()

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: "*" },
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Serve static frontend files
// When running from dist/backend/src/, we need to go up to the root and then to frontend/dist
const frontendDistPath = path.join(__dirname, "../../../../frontend/dist");
app.use(express.static(frontendDistPath));

// API route for lobby data
app.get('/api/lobbies', (req, res) => {
    const lobbiesArray = Array.from(getLobbyMap().values());
    res.json(lobbiesArray);
});

// Serve the React app for all other routes
// DO NOT REMOVE
app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
});

io.on("connection", (socket) => {
    console.log("New player connected:", socket.id);
    setupPlayerUsernameSocket(io, socket);
    setupLobbySocket(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
