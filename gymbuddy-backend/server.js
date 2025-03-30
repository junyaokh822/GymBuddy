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
const User = require('./models/User');

dotenv.config();
connectDB();

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
  console.log(`User connected: ${socket.userId}`);
  
  // Join a personal room based on user ID
  socket.join(socket.userId.toString());
  
  // Handle private message sending
  socket.on('send_message', async (data) => {
    try {
      const { recipientId, content } = data;
      
      // Save message to database through the message route handler
      // We'll implement this in the message routes
      
      // Emit to recipient's room if they're online
      io.to(recipientId).emit('receive_message', {
        _id: data._id,
        sender: socket.userId,
        senderName: `${socket.user.firstname} ${socket.user.lastname}`,
        content,
        createdAt: new Date()
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
    console.log(`User disconnected: ${socket.userId}`);
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

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));