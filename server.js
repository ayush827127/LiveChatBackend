// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS middleware
app.use(cors({
    origin: 'http://localhost:5173/', // Replace with your frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

const server = http.createServer(app);
const io = socketIo(server);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chatApp').then(() => {
    console.log('MongoDB connected');
}).catch(err => console.log(err));

// Define MongoDB schemas and models
const userSchema = new mongoose.Schema({
    username: String,
    coins: Number
});

const messageSchema = new mongoose.Schema({
    sender: String,
    content: String,
    wordCount: Number,
    coinsSpent: Number
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Socket.io setup
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('sendMessage', async (data) => {
        const { sender, content } = data;
        const wordCount = content.split(' ').length;
        const coinsRequired = Math.ceil(wordCount / 50) * 5;

        try {
            const user = await User.findOne({ username: sender });

            if (!user) {
                socket.emit('errorMessage', 'User not found');
                return;
            }

            if (user.coins >= coinsRequired) {
                user.coins -= coinsRequired;
                await user.save();

                const message = new Message({ sender, content, wordCount, coinsSpent: coinsRequired });
                await message.save();

                io.emit('receiveMessage', { sender, content });
            } else {
                socket.emit('errorMessage', 'Not enough coins to send the message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('errorMessage', 'Error sending message');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// API endpoints
app.post('/user', async (req, res) => {
    const { username, coins } = req.body;
    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            res.status(400).send('Username already exists');
            return;
        }

        const user = new User({ username, coins });
        await user.save();
        res.send(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error creating user');
    }
});

app.get('/user/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        res.send(user);
    } catch (error) {
        console.error('Error finding user:', error);
        res.status(500).send('Error finding user');
    }
});

app.get('/', (req, res) => {
    res.send('Chat Server is running');
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
