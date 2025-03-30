const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const matchingService = require("../utils/matchingService");
const User = require("../models/User");

// Protect all routes in this router
router.use(authMiddleware);

/**
 * GET /api/matches
 * Get potential gym buddies for the current user
 */
router.get("/", async (req, res) => {
  try {
    // Extract query parameters with defaults
    const threshold = parseFloat(req.query.threshold) || 0.5; // Lower threshold to find more matches
    const daysAhead = parseInt(req.query.daysAhead) || 14; // Look 2 weeks ahead by default
    
    console.log(`DEBUG: Auth req.user:`, req.user);
    
    // Fix issue with user ID extraction
    let userId = null;
    if (req.user.id) {
      userId = req.user.id;
    } else if (req.user._id) {
      userId = req.user._id;
    } else {
      console.error("Neither req.user.id nor req.user._id found in token");
      // Attempt to extract ID directly from req.user if it's a string or object
      if (typeof req.user === 'string') {
        userId = req.user;
      } else if (req.user && typeof req.user === 'object') {
        // Last resort - use first property that looks like an ID
        for (const key in req.user) {
          if (req.user[key] && /^[0-9a-fA-F]{24}$/.test(req.user[key])) {
            userId = req.user[key];
            console.log(`Found potential user ID in property ${key}`);
            break;
          }
        }
      }
    }
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token, please log in again",
        debug: { tokenUser: req.user }
      });
    }
    
    console.log(`Finding matches for user ID: ${userId} with threshold: ${threshold} and daysAhead: ${daysAhead}`);
    
    // Find potential gym buddies
    const matches = await matchingService.findPotentialBuddies(
      userId,
      threshold,
      daysAhead
    );
    
    console.log(`Found ${matches.length} potential matches for user ${userId}`);
    
    // Return matches
    res.status(200).json({
      success: true,
      count: matches.length,
      matches: matches || []
    });
  } catch (error) {
    console.error("Match finding error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to find matches",
      error: error.message
    });
  }
});

/**
 * GET /api/matches/debug
 * Get debug information about user's events and potential matches
 */
router.get("/debug", async (req, res) => {
  try {
    let userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }
    
    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false, 
        message: "User not found"
      });
    }
    
    // Get basic data to debug matching
    const CalendarEvent = require("../models/CalendarEvent");
    const now = new Date();
    
    // Get user's events
    const userEvents = await CalendarEvent.find({
      userId: userId,
      start: { $gte: now }
    });
    
    // Get other users' shared events
    const sharedEvents = await CalendarEvent.find({
      userId: { $ne: userId },
      shared: true,
      start: { $gte: now }
    }).populate('userId', 'firstname lastname preferences');
    
    // Get all users for potential matching
    const otherUsers = await User.find({
      _id: { $ne: userId }
    }, 'firstname lastname preferences');
    
    res.status(200).json({
      success: true,
      debug: {
        currentUser: {
          _id: currentUser._id,
          firstname: currentUser.firstname,
          lastname: currentUser.lastname,
          preferences: currentUser.preferences
        },
        userEvents: userEvents.map(e => ({
          _id: e._id,
          title: e.title,
          start: e.start,
          end: e.end,
          shared: e.shared
        })),
        sharedEventCount: sharedEvents.length,
        otherUserCount: otherUsers.length,
        otherUsers: otherUsers.map(u => ({
          _id: u._id,
          firstname: u.firstname,
          lastname: u.lastname,
          preferences: u.preferences
        }))
      }
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving debug information",
      error: error.message
    });
  }
});

/**
 * POST /api/matches/contact/:matchId
 * Send a connection request to potential gym buddy
 */
router.post("/contact/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    const fromUserId = req.user.id || req.user._id;
    
    if (!fromUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }
    
    // Validate input
    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }
    
    // Get user information
    const fromUser = await User.findById(fromUserId);
    if (!fromUser) {
      return res.status(404).json({
        success: false,
        message: "Sender user not found"
      });
    }
    
    // Send email notification
    const toUser = await User.findById(matchId);
    if (!toUser) {
      return res.status(404).json({
        success: false,
        message: "Recipient user not found"
      });
    }
    
    // Use the existing email service
    const sendEmail = require("../utils/sendEmail");
    
    await sendEmail(
      toUser.email,
      "GymBuddy Connection Request",
      `
        <h2>Hi ${toUser.firstname},</h2>
        <p>${fromUser.firstname} ${fromUser.lastname} wants to connect with you on GymBuddy!</p>
        <p><strong>Their message:</strong> "${message}"</p>
        <p>You can reply directly to this email to connect with them, or log in to your GymBuddy account to see all your matches.</p>
        <p>Email: ${fromUser.email}</p>
        <hr>
        <p>Happy workouts!</p>
        <p>- The GymBuddy Team</p>
      `
    );
    
    res.status(200).json({
      success: true,
      message: "Connection request sent successfully"
    });
    
  } catch (error) {
    console.error("Connection request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send connection request",
      error: error.message
    });
  }
});

module.exports = router;