const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 250MB Buffer size taaki 200MB+ ki original video/files bina error ke ja sakein
const io = new Server(server, {
    maxHttpBufferSize: 250 * 1024 * 1024 
});

app.use(express.static(path.join(__dirname, 'public')));

let groupName = "🌸Hello Dosto😊🙂";
let connectedUsers = {};
let messagesHistory = []; // Server side memory for history

io.on('connection', (socket) => {
    socket.on('join-chat', (name) => {
        socket.username = name;
        connectedUsers[socket.id] = name;
        
        // Send existing group name, users, and history to new/refreshed user
        socket.emit('update-group-name', groupName);
        socket.emit('load-history', messagesHistory);
        io.emit('update-users-list', Object.values(connectedUsers));
    });

    socket.on('chat-message', (data) => {
        messagesHistory.push(data);
        if (messagesHistory.length > 200) messagesHistory.shift(); // Keep last 200 messages
        io.emit('chat-message', data);
    });

    socket.on('add-reaction', ({ messageId, reaction, name }) => {
        const msg = messagesHistory.find(m => m.id === messageId);
        if (msg) {
            if (!msg.reactions) msg.reactions = {};
            msg.reactions[name] = reaction;
            io.emit('update-reaction', { messageId, reactions: msg.reactions });
        }
    });

    socket.on('change-group-name', (name) => {
        groupName = name;
        io.emit('update-group-name', groupName);
    });

    socket.on('typing', (name) => {
        socket.broadcast.emit('typing', name);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('stop-typing');
    });

    socket.on('disconnect', () => {
        delete connectedUsers[socket.id];
        io.emit('update-users-list', Object.values(connectedUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
