const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const verifyToken = require('./middleware/authMiddleware');
const calendarRoutes = require("./routes/calendar");
const matchesRoutes = require("./routes/matches");
const messageRoutes = require("./routes/messages");
const friendsRoutes = require("./routes/friends");
const User = require('./models/User');

dotenv.config();

// Only connect to the database when not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*', // In production, specify your frontend URL
    methods: ['GET', 'POST']
  }
});

// ✅ Add middleware for JSON parsing & security
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    
    // Store the user ID in the socket object for later use
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.user = {
      _id: user._id,
      firstname: user.firstname,
      lastname: user.lastname
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (Socket ID: ${socket.id})`);
  
  // Join a personal room based on user ID
  socket.join(socket.userId.toString());
  console.log(`Socket ${socket.id} joined room: ${socket.userId.toString()}`);
  
  // Log all rooms this socket is in
  const rooms = Array.from(socket.rooms);
  console.log(`Socket ${socket.id} is in rooms:`, rooms);
  
  // Handle private message sending
  socket.on('send_message', async (data) => {
    try {
      const { recipientId, content } = data;
      console.log(`Message from ${socket.userId} to ${recipientId}: ${content}`);
      
      // Create message document
      const Message = require('./models/Message');
      const newMessage = new Message({
        sender: socket.userId,
        recipient: recipientId,
        content,
        read: false
      });
      
      await newMessage.save();
      console.log(`Message saved with ID: ${newMessage._id}`);
      
      // Emit to recipient's room if they're online
      io.to(recipientId).emit('receive_message', {
        _id: newMessage._id,
        sender: socket.userId,
        senderName: `${socket.user.firstname} ${socket.user.lastname}`,
        content,
        createdAt: new Date()
      });
      
      // Also notify about unread message
      io.to(recipientId).emit('new_unread_message', {
        count: 1,
        sender: {
          _id: socket.userId,
          name: `${socket.user.firstname} ${socket.user.lastname}`
        }
      });
      
      // Emit success back to sender
      socket.emit('message_sent', {
        success: true,
        messageId: newMessage._id,
        recipientId
      });
      
    } catch (error) {
      console.error('Error sending message via socket:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', async (data) => {
    try {
      const { to } = data;
      console.log(`Typing indicator from ${socket.userId} to ${to}`);
      
      // Emit typing event to recipient
      io.to(to).emit('typing', { 
        from: socket.userId,
        name: `${socket.user.firstname}`
      });
      
    } catch (error) {
      console.error('Error with typing indicator:', error);
    }
  });
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId} (Socket ID: ${socket.id})`);
  });
});

// Make io accessible to routes
app.set('io', io);

// ✅ Authentication Routes (Login & Register)
app.use('/api/auth', require('./routes/auth'));

// ✅ Protected Route Example
app.get("/api/protected", verifyToken, (req, res) => {
    res.json({ message: "This is a protected route!", user: req.user });
});

app.use("/api/calendar", calendarRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendsRoutes);

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;

// Only start the server when not in test mode
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
}

// Export the app for testing
module.exports = { app, server };