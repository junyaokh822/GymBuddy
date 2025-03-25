const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
        return res.status(401).json({ message: "Access Denied! No token provided." });
    }

    try {
        // ✅ Remove 'Bearer ' prefix if present
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next(); // Proceed to next middleware
    } catch (error) {
        console.error("❌ Token Verification Error:", error.message);
        res.status(400).json({ message: "Invalid token" });
    }
};

module.exports = verifyToken;
