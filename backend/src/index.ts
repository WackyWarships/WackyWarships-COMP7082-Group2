import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from "http";
import { Server } from "socket.io";
import { getLobbyMap, setupSocket } from "./lobby.js";

import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from '../../shared/types.js';

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
   cors: { origin: "*" } 
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve frontend build files
app.get('*', (req, res) => {
  res.send(getLobbyMap());
});

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  setupSocket(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));