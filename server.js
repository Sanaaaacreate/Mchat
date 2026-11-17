const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render पर एनवायरनमेंट वेरिएबल से कनेक्शन लेगा
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://maxdeepakgaming221_db_user:ADJERNHMEIKETPR@chatuuuu.hwr0ief.mongodb.net/';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB से सफलतापूर्वक कनेक्ट हो गया!"))
  .catch(err => console.error("❌ MongoDB कनेक्शन एरर:", err));

// Database Schema with 24-Hour Auto-Delete & Reactions
const messageSchema = new mongoose.Schema({
    groupName: { type: String, default: 'Hello dosto 😊🙂' },
    sender: String,
    type: String, // 'text' or 'media'
    text: String,
    mediaUrl: String,
    fileName: String,
    fileType: String,
    replyTo: Object,
    readBy: [{ reader: String, time: String }],
    reactions: [{ user: String, emoji: String }],
    createdAt: { type: Date, default: Date.now, expires: 86400 } // ⏳ ठीक 24 घंटे में ऑटो-डिलीट
});

const Message = mongoose.model('Message', messageSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

io.on('connection', (socket) => {
    console.log('🟢 नया यूजर जुड़ा:', socket.id);

    Message.find().sort({ createdAt: 1 }).limit(100).then(messages => {
        socket.emit('load_history', messages);
    });

    socket.on('send_message', async (data) => {
        try {
            const newMessage = new Message({
                groupName: data.groupName || 'Hello dosto 😊🙂',
                sender: data.sender,
                type: data.type,
                text: data.text,
                mediaUrl: data.mediaUrl,
                fileName: data.fileName,
                fileType: data.fileType,
                replyTo: data.replyTo,
                readBy: []
            });
            await newMessage.save();
            io.emit('receive_message', newMessage);
        } catch (err) {
            console.error("मैसेज सेव करने में त्रुटि:", err);
        }
    });

    socket.on('mark_read', async ({ msgId, reader }) => {
        try {
            const msg = await Message.findById(msgId);
            if (msg && !msg.readBy.some(r => r.reader === reader)) {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msg.readBy.push({ reader, time: timeStr });
                await msg.save();
                io.emit('update_read_receipt', { msgId, readBy: msg.readBy });
            }
        } catch (err) {
            console.error("Read receipt error:", err);
        }
    });

    socket.on('add_reaction', async ({ msgId, user, emoji }) => {
        try {
            const msg = await Message.findById(msgId);
            if (msg) {
                msg.reactions = msg.reactions.filter(r => r.user !== user);
                msg.reactions.push({ user, emoji });
                await msg.save();
                io.emit('update_reactions', { msgId, reactions: msg.reactions });
            }
        } catch (err) {
            console.error("Reaction error:", err);
        }
    });

    socket.on('delete_message', async (msgId) => {
        try {
            await Message.findByIdAndDelete(msgId);
            io.emit('message_deleted', msgId);
        } catch (err) {
            console.error("Delete error:", err);
        }
    });

    socket.on('update_group_name', (name) => {
        io.emit('group_name_updated', name);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्वर पोर्ट ${PORT} पर चल रहा है!`);
});
