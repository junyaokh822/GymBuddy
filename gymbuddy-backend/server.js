const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const verifyToken = require('./middleware/authMiddleware'); // ✅ Middleware to protect routes
const calendarRoutes = require("./routes/calendar");

dotenv.config();
connectDB();

const app = express();

// ✅ Add middleware for JSON parsing & security
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Authentication Routes (Login & Register)
// app.use("/api/auth", authRoutes);
app.use('/api/auth', require('./routes/auth'));

// ✅ Protected Route Example
app.get("/api/protected", verifyToken, (req, res) => {
    res.json({ message: "This is a protected route!", user: req.user });
});

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
});

app.use("/api/calendar", calendarRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
