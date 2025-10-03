const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {},
    cors: {
      origin: "http://localhost:8080"
    }
});

io.on('connection', (socket) => {
    
    console.log('a user connected');

    // join the room named 'some room'
    //socket.join('some room');
    
    // broadcast to all connected clients in the room
    //io.to('some room').emit('hello', 'world');

    // broadcast to all connected clients except those in the room
    //io.except('some room').emit('hello', 'world');

    // leave the room
    //socket.leave('some room');

    socket.on('message', (msg) => {
        console.log('message: ' + msg);
    });

    socket.on('disconnect', () => {
        console.log('user disconnnected');
    });
})

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});