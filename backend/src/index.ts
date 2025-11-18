import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { getLobbyMap, setupSocket as setupLobbySocket } from "./lobby.js";
import { setupMultiplayerSocket } from "./multiplayer.js";
import { setupSocket as setupPlayerUsernameSocket } from "./playerUsername.js";

import { setupDirectSocket } from "./direct.js";

import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../../shared/types.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: "*" },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:8080"];

app.use(
    cors({
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    })
);

// API endpoint
app.get("/api/lobbies", (req, res) => {
    const lobbiesArray = Array.from(getLobbyMap().values());
    res.json(lobbiesArray);
});

// Frontend in prod only
if (isProd) {
    const frontendDistPath = path.join(__dirname, "../../../../frontend/dist");
    app.use(express.static(frontendDistPath));

    // Serve built frontend for all other routes
    app.get("*", (req, res) => {
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

/*
    Uses the dummy authentication service in the middleware for socket conections.
    If the service is unavailable or returns false, socket connections would be rejected.
*/
io.use(async (socket, next) => {
    try {
        const authUrl = process.env.AUTH_SERVICE_URL || "https://wacky-warships-auth-service-dd93b0c09c19.herokuapp.com/auth";
        const response = await fetch(authUrl);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Auth service response data:`, data);
            if (data.authenticated) {
                console.log('Authentication successful');
                next();
            } else {
                console.log('Authentication failed - data.authenticated is false');
                next(new Error("Authentication failed"));
            }
        } else {
            console.log(`Auth service unavailable - status: ${response.status}`);
            next(new Error("Auth service unavailable"));
        }
    } catch (error) {
        console.log('Auth service error:', error);
        next(new Error("Auth service error"));
    }
});

// socket.io
io.on("connection", (socket) => {
    console.log("New player connected:", socket.id);
    setupPlayerUsernameSocket(io, socket);
    setupLobbySocket(io, socket);
    setupDirectSocket(io, socket);
    setupMultiplayerSocket(io, socket);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log(
        `Backend running on port ${PORT} [${isProd ? "Production" : "Development"}]`
    )
);
