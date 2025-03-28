const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.header("Authorization");

    // Check if Authorization header exists
    if (!authHeader) {
        return res.status(401).json({ message: "Access Denied! No token provided." });
    }

    try {
        // Extract token, handling both "Bearer TOKEN" and direct token formats
        const token = authHeader.startsWith("Bearer ") 
            ? authHeader.slice(7).trim() 
            : authHeader;

        // Verify the token
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach verified user to request object
        req.user = verified;
        
        // Proceed to next middleware
        next();
    } catch (error) {
        console.error("❌ Token Verification Error:", error.message);
        res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = verifyToken;