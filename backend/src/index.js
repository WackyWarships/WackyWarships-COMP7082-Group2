import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  socket.on("attack", (data) => {
    console.log("Attack:", data);
    io.emit("updateHealth", data);
  });
});

server.listen(3000, () => console.log("Backend running on port 3000"));
