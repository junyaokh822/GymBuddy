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
        
        console.log("Token verified successfully:", verified);
        
        // Attach verified user to request object
        req.user = verified;
        
        // Print debug info
        if (typeof verified === 'object') {
            console.log("User ID from token:", verified.id || verified._id || "No ID found");
        }
        
        // Proceed to next middleware
        next();
    } catch (error) {
        console.error("❌ Token Verification Error:", error.message);
        res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = verifyToken;