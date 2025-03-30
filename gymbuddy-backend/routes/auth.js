const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const authMiddleware = require('../middleware/authMiddleware');

// REGISTER (Sign Up)
router.post('/register', async (req, res) => {
    try {
        console.log("🟢 Incoming Request:", req.body); // Debugging Log

        const { firstname, lastname, email, password } = req.body;

        // Check for missing fields
        if (!firstname || !lastname || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User
        user = new User({
            firstname,
            lastname,
            email,
            password: hashedPassword,
        });

        await user.save();
        res.status(201).json({ message: "User registered successfully!" });
    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// LOGIN (Sign In)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Validate Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Generate Token with 24h expiration and consistent id field
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });

        res.json({ 
            token, 
            user: {
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                preferences: user.preferences || []
            } 
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");
        const expiration = Date.now() + 3600000; // 1 hour

        user.resetToken = token;
        user.resetTokenExpiration = expiration;
        await user.save();

        // Send reset email
        const resetLink = `${process.env.BASE_URL}/GymBuddy/reset-password.html?token=${token}`;

        await sendEmail(user.email, "Password Reset Request", `
            <h2>Hi ${user.firstname},</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
        `);

        res.json({ message: "Reset link sent to email." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;

    try {
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired token" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiration = undefined;
        await user.save();

        res.json({ message: "Password reset successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// PUT /api/users/:id
router.put("/users/:id", async (req, res) => {
    console.log("Updating user:", req.params.id, req.body);

    try {
        const updated = await User.findByIdAndUpdate(
            req.params.id,
            {
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                email: req.body.email,
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User updated", user: updated });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.put("/change-password/:id", async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);

        user.password = hashed;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("Password update error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

router.put('/preferences/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { preferences } = req.body;

    // Validate input
    if (!Array.isArray(preferences)) {
        return res.status(400).json({ message: "Preferences must be an array." });
    }

    try {
        // Find user and update with new preferences
        const user = await User.findByIdAndUpdate(
            id,
            { preferences },
            {
                new: true,  // Return updated document
                runValidators: true  // Validate update operation
            }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Explicitly send a clean response
        return res.status(200).json({
            message: "Preferences updated successfully.",
            user: {
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                preferences: user.preferences
            }
        });

    } catch (err) {
        console.error("Preference update error:", err);

        // Ensure no headers have been sent before responding
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Server error while saving preferences.",
                error: err.message
            });
        }
    }
});

module.exports = router;